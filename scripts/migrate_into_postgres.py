"""Script to migrate MongoDB data into PostgreSQL relational schema."""

import os
import sys
import json
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.db.session import async_session_factory
from app.models.entities import (
    User,
    Subject,
    Document,
    DocumentVersion,
    DocumentEvidence,
    utc_now,
)


def parse_datetime(val) -> datetime:
    if not val:
        return utc_now()
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return utc_now()
    if isinstance(val, dict) and "$date" in val:
        return parse_datetime(val["$date"])
    return utc_now()


async def run_migration():
    json_path = Path(__file__).resolve().parent / "mongo_data.json"
    if not json_path.exists():
        print(f"Error: {json_path} not found. Run export_mongo.js first.")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    users_data = data.get("users", [])
    subjects_data = data.get("subjects", [])
    chunks_data = data.get("chunks", [])

    print(f"Loaded {len(users_data)} users, {len(subjects_data)} subjects, {len(chunks_data)} chunks from export.")

    user_map = {}     # mongo_user_id -> postgres_uuid
    subject_map = {}  # mongo_subject_id -> postgres_uuid
    doc_map = {}      # (postgres_subject_id, filename) -> (doc_id, version_id)

    async with async_session_factory() as session:
        async with session.begin():
            # 1. Migrate Users
            print("--- Migrating Users ---")
            for u in users_data:
                mongo_id = str(u["_id"])
                email = u.get("email") or f"{mongo_id}@migrated.local"
                name = u.get("name") or u.get("username") or "User"
                pwd = u.get("password")

                # Check if already migrated
                stmt = select(User).where((User.mongo_id == mongo_id) | (User.email == email))
                existing_user = (await session.execute(stmt)).scalar_one_or_none()

                if existing_user:
                    user_map[mongo_id] = existing_user.id
                    print(f"User {email} already exists -> UUID {existing_user.id}")
                else:
                    new_user = User(
                        id=uuid.uuid4(),
                        email=email,
                        name=name,
                        password_hash=pwd,
                        mongo_id=mongo_id,
                        created_at=parse_datetime(u.get("createdAt")),
                        updated_at=parse_datetime(u.get("updatedAt")),
                    )
                    session.add(new_user)
                    await session.flush()
                    user_map[mongo_id] = new_user.id
                    print(f"Created User {email} -> UUID {new_user.id}")

            # 2. Migrate Subjects
            print("--- Migrating Subjects ---")
            for s in subjects_data:
                mongo_sub_id = str(s["_id"])
                mongo_user_id = str(s.get("userId"))
                pg_user_id = user_map.get(mongo_user_id)

                if not pg_user_id:
                    print(f"Warning: Subject {s.get('name')} owner {mongo_user_id} not found in users; skipping.")
                    continue

                stmt = select(Subject).where(
                    Subject.user_id == pg_user_id,
                    Subject.name == s["name"],
                )
                existing_sub = (await session.execute(stmt)).scalar_one_or_none()

                if existing_sub:
                    subject_map[mongo_sub_id] = existing_sub.id
                    pg_sub_id = existing_sub.id
                    print(f"Subject '{s['name']}' already exists -> UUID {pg_sub_id}")
                else:
                    new_sub = Subject(
                        id=uuid.uuid4(),
                        user_id=pg_user_id,
                        name=s["name"],
                        created_at=parse_datetime(s.get("createdAt")),
                        updated_at=utc_now(),
                    )
                    session.add(new_sub)
                    await session.flush()
                    subject_map[mongo_sub_id] = new_sub.id
                    pg_sub_id = new_sub.id
                    print(f"Created Subject '{s['name']}' -> UUID {pg_sub_id}")

                # Migrate Subject Notes / Documents
                all_docs = list(s.get("notes", [])) + list(s.get("researchPapers", []))
                for doc_entry in all_docs:
                    filename = doc_entry.get("filename")
                    original_name = doc_entry.get("originalName", filename)
                    if not filename:
                        continue

                    key1 = (pg_sub_id, filename)
                    key2 = (pg_sub_id, original_name)
                    if key1 in doc_map or key2 in doc_map:
                        continue

                    # Check if document already exists
                    doc_stmt = select(Document).where(
                        Document.subject_id == pg_sub_id,
                        Document.original_filename == original_name,
                    )
                    existing_doc = (await session.execute(doc_stmt)).scalar_one_or_none()

                    if existing_doc:
                        v_stmt = select(DocumentVersion).where(DocumentVersion.document_id == existing_doc.id)
                        ver = (await session.execute(v_stmt)).scalars().first()
                        doc_map[key1] = (existing_doc.id, ver.id if ver else None)
                        doc_map[key2] = (existing_doc.id, ver.id if ver else None)
                    else:
                        ext = Path(original_name).suffix.lower().lstrip(".")
                        new_doc = Document(
                            id=uuid.uuid4(),
                            user_id=pg_user_id,
                            subject_id=pg_sub_id,
                            original_filename=original_name,
                            display_name=original_name,
                            file_type=ext or "bin",
                            mime_type=f"application/{ext}" if ext else "application/octet-stream",
                            file_size_bytes=0,
                            storage_key=f"uploads/{filename}",
                            processing_status="completed",
                            created_at=parse_datetime(doc_entry.get("uploadedAt")),
                            updated_at=utc_now(),
                        )
                        session.add(new_doc)
                        await session.flush()

                        new_ver = DocumentVersion(
                            id=uuid.uuid4(),
                            document_id=new_doc.id,
                            version_number=1,
                            storage_key=f"uploads/{filename}",
                            file_size_bytes=0,
                            created_at=new_doc.created_at,
                        )
                        session.add(new_ver)
                        await session.flush()
                        doc_map[key1] = (new_doc.id, new_ver.id)
                        doc_map[key2] = (new_doc.id, new_ver.id)
                        print(f"  Created Document '{original_name}' -> UUID {new_doc.id}")

            # 3. Migrate Document Chunks into Evidence Records
            print(f"--- Migrating {len(chunks_data)} Document Chunks to Evidence Records ---")
            evidence_count = 0
            for chunk in chunks_data:
                mongo_sub_id = str(chunk.get("subjectId"))
                c_fname = chunk.get("filename")
                c_orig = chunk.get("originalName", c_fname)
                pg_sub_id = subject_map.get(mongo_sub_id)

                if not pg_sub_id:
                    continue

                doc_entry = doc_map.get((pg_sub_id, c_orig)) or doc_map.get((pg_sub_id, c_fname))
                if not doc_entry:
                    continue

                _, ver_id = doc_entry
                if not ver_id:
                    continue

                evidence = DocumentEvidence(
                    id=uuid.uuid4(),
                    document_version_id=ver_id,
                    page_number=chunk.get("chunkIndex", 0) + 1,
                    element_type="text_chunk",
                    content=chunk.get("content", ""),
                    parser_metadata={"chunk_index": chunk.get("chunkIndex")},
                    created_at=parse_datetime(chunk.get("createdAt")),
                )
                session.add(evidence)
                evidence_count += 1

            await session.flush()
            print(f"Successfully migrated {evidence_count} evidence records.")

    print("=== Migration to PostgreSQL Complete & Verified! ===")


if __name__ == "__main__":
    asyncio.run(run_migration())

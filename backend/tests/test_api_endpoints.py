"""REST API Integration Tests for Multimodal Document Intelligence Persistence Endpoints."""

import uuid
import pytest
from httpx import AsyncClient

from app.models.entities import User
from app.db.session import async_session_factory


@pytest.fixture
async def api_user():
    """Create a unique authenticated user for API endpoint tests."""
    user = User(
        id=uuid.uuid4(),
        email=f"api_tester_{uuid.uuid4().hex[:6]}@test.local",
        name="API Tester",
    )
    async with async_session_factory() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_subject_api_lifecycle(async_client: AsyncClient, api_user: User):
    """Test full Subject REST API lifecycle: Create -> List -> Get -> Update -> Delete."""
    headers = {"X-User-Id": str(api_user.id)}

    # 1. Create subject
    create_res = await async_client.post(
        "/api/v1/subjects",
        json={"name": "Cybersecurity", "description": "Network Defense"},
        headers=headers,
    )
    assert create_res.status_code == 201
    created_sub = create_res.json()
    sub_id = created_sub["id"]
    assert created_sub["name"] == "Cybersecurity"

    # 2. List subjects
    list_res = await async_client.get("/api/v1/subjects", headers=headers)
    assert list_res.status_code == 200
    subs = list_res.json()
    assert any(s["id"] == sub_id for s in subs)

    # 3. Get subject with counts
    get_res = await async_client.get(f"/api/v1/subjects/{sub_id}", headers=headers)
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["name"] == "Cybersecurity"
    assert detail["document_count"] == 0
    assert detail["resource_count"] == 0

    # 4. Update subject
    update_res = await async_client.patch(
        f"/api/v1/subjects/{sub_id}",
        json={"name": "Cybersecurity & Cryptography"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Cybersecurity & Cryptography"

    # 5. Delete subject
    del_res = await async_client.delete(f"/api/v1/subjects/{sub_id}", headers=headers)
    assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_document_api_lifecycle(async_client: AsyncClient, api_user: User):
    """Test Document REST API: Register -> List -> Status -> Retry -> Delete."""
    headers = {"X-User-Id": str(api_user.id)}

    # Create subject
    sub_res = await async_client.post(
        "/api/v1/subjects",
        json={"name": "Quantum Computing"},
        headers=headers,
    )
    sub_id = sub_res.json()["id"]

    # Register document
    doc_res = await async_client.post(
        f"/api/v1/documents/{sub_id}",
        json={
            "original_filename": "shor_algorithm.pdf",
            "display_name": "Shor Algorithm Guide",
            "file_type": "pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 102400,
            "storage_key": "uploads/shor_algorithm.pdf",
        },
        headers=headers,
    )
    assert doc_res.status_code == 201
    doc = doc_res.json()
    doc_id = doc["id"]
    assert doc["processing_status"] == "uploaded"

    # List documents
    list_res = await async_client.get(f"/api/v1/documents/{sub_id}", headers=headers)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) >= 1

    # Check status
    status_res = await async_client.get(f"/api/v1/documents/{sub_id}/{doc_id}/status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["processing_status"] == "uploaded"

    # Retry processing
    retry_res = await async_client.post(f"/api/v1/documents/{sub_id}/{doc_id}/retry", headers=headers)
    assert retry_res.status_code == 200
    assert retry_res.json()["processing_status"] == "queued"

    # Delete document
    del_res = await async_client.delete(f"/api/v1/documents/{sub_id}/{doc_id}", headers=headers)
    assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_mcq_and_assessment_api_workflow(async_client: AsyncClient, api_user: User):
    """Test MCQ Sets & Assessment Attempts via REST API."""
    headers = {"X-User-Id": str(api_user.id)}

    # Create subject
    sub_res = await async_client.post(
        "/api/v1/subjects",
        json={"name": "Calculus"},
        headers=headers,
    )
    sub_id = sub_res.json()["id"]

    # Save MCQ set
    mcq_res = await async_client.post(
        f"/api/v1/mcq/{sub_id}/sets",
        json={
            "title": "Derivatives & Integrals",
            "description": "Calculus 101 Quiz",
            "difficulty": "medium",
            "questions": [
                {
                    "question_text": "What is the derivative of x^2?",
                    "explanation": "Power rule: d/dx(x^n) = n*x^(n-1).",
                    "question_order": 0,
                    "correct_option_label": "B",
                    "options": [
                        {"option_text": "x", "option_label": "A", "option_order": 0},
                        {"option_text": "2x", "option_label": "B", "option_order": 1},
                        {"option_text": "2", "option_label": "C", "option_order": 2},
                        {"option_text": "x^3 / 3", "option_label": "D", "option_order": 3},
                    ],
                }
            ],
        },
        headers=headers,
    )
    assert mcq_res.status_code == 201
    mcq_set = mcq_res.json()
    set_id = mcq_set["id"]

    # Open in quiz mode (correct answer hidden)
    quiz_res = await async_client.get(
        f"/api/v1/mcq/{sub_id}/sets/{set_id}?mode=quiz",
        headers=headers,
    )
    assert quiz_res.status_code == 200
    quiz_data = quiz_res.json()
    assert quiz_data["questions"][0]["correct_option_id"] is None

    # Create assessment
    ass_res = await async_client.post(
        f"/api/v1/mcq/{sub_id}/assessments",
        json={"title": "Calculus Midterm", "mcq_set_id": set_id},
        headers=headers,
    )
    assert ass_res.status_code == 201
    ass_id = ass_res.json()["id"]

    # Start attempt
    att_res = await async_client.post(
        f"/api/v1/mcq/assessments/{ass_id}/attempt",
        headers=headers,
    )
    assert att_res.status_code == 201
    att_id = att_res.json()["id"]

    # Submit attempt (find correct option from study mode)
    study_res = await async_client.get(
        f"/api/v1/mcq/{sub_id}/sets/{set_id}?mode=study",
        headers=headers,
    )
    correct_opt_id = study_res.json()["questions"][0]["correct_option_id"]
    q_id = study_res.json()["questions"][0]["id"]

    sub_att_res = await async_client.post(
        f"/api/v1/mcq/attempts/{att_id}/submit",
        json={
            "answers": [{"question_id": q_id, "selected_option_id": correct_opt_id}],
            "duration_seconds": 30,
        },
        headers=headers,
    )
    assert sub_att_res.status_code == 200
    result = sub_att_res.json()
    assert result["status"] == "completed"
    assert result["score"] == 1.0
    assert result["percentage"] == 100.0


@pytest.mark.asyncio
async def test_short_answer_api_workflow(async_client: AsyncClient, api_user: User):
    """Test Short Answer Sets & Practice Attempts via REST API."""
    headers = {"X-User-Id": str(api_user.id)}

    # Create subject
    sub_res = await async_client.post(
        "/api/v1/subjects",
        json={"name": "Software Engineering"},
        headers=headers,
    )
    sub_id = sub_res.json()["id"]

    # Save short-answer set
    sa_res = await async_client.post(
        f"/api/v1/short-answers/{sub_id}/sets",
        json={
            "title": "Design Patterns",
            "questions": [
                {
                    "question_text": "What is the Singleton pattern?",
                    "model_answer": "Ensures a class has only one instance and provides a global point of access.",
                    "question_order": 0,
                    "max_score": 5.0,
                }
            ],
        },
        headers=headers,
    )
    assert sa_res.status_code == 201
    sa_data = sa_res.json()
    set_id = sa_data["id"]
    q_id = sa_data["questions"][0]["id"]

    # Start attempt
    att_res = await async_client.post(
        f"/api/v1/short-answers/sets/{set_id}/attempt",
        headers=headers,
    )
    assert att_res.status_code == 201
    att_id = att_res.json()["id"]

    # Submit student response
    resp_res = await async_client.post(
        f"/api/v1/short-answers/attempts/{att_id}/responses",
        json={
            "responses": [
                {
                    "question_id": q_id,
                    "student_answer": "It restricts instantiation to a single object.",
                }
            ]
        },
        headers=headers,
    )
    assert resp_res.status_code == 200
    att_data = resp_res.json()
    assert att_data["status"] == "completed"
    assert att_data["responses"][0]["student_answer"] == "It restricts instantiation to a single object."


@pytest.mark.asyncio
async def test_study_activity_api(async_client: AsyncClient, api_user: User):
    """Test Study Activity & View Tracking via REST API."""
    headers = {"X-User-Id": str(api_user.id)}

    sub_res = await async_client.post(
        "/api/v1/subjects",
        json={"name": "Biology"},
        headers=headers,
    )
    sub_id = sub_res.json()["id"]

    sa_res = await async_client.post(
        f"/api/v1/short-answers/{sub_id}/sets",
        json={
            "title": "Cell Biology",
            "questions": [
                {
                    "question_text": "What is the powerhouse of the cell?",
                    "model_answer": "Mitochondria produce ATP through cellular respiration.",
                    "question_order": 0,
                }
            ],
        },
        headers=headers,
    )
    res_id = sa_res.json()["resource_id"]

    # Record view
    view_res = await async_client.post(
        f"/api/v1/activity/view/{res_id}",
        headers=headers,
    )
    assert view_res.status_code == 200
    view_data = view_res.json()
    assert view_data["view_count"] >= 2  # 1 from creation + 1 from view endpoint

    # Get subject activity
    act_res = await async_client.get(
        f"/api/v1/activity/subject/{sub_id}",
        headers=headers,
    )
    assert act_res.status_code == 200
    activities = act_res.json()
    assert len(activities) >= 2

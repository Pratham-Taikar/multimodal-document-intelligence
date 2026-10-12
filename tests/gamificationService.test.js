const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const User = require("../models/User");
const {
  BADGES_CATALOG,
  calculateLevel,
  calculateLevelProgress,
  awardUserXP,
  getUserStats
} = require("../services/gamificationService");

const originalFindById = User.findById;

afterEach(() => {
  User.findById = originalFindById;
});

test("1. calculateLevel and calculateLevelProgress calculate accurate metrics", () => {
  assert.equal(calculateLevel(0), 1);
  assert.equal(calculateLevel(50), 1);
  assert.equal(calculateLevel(99), 1);
  assert.equal(calculateLevel(100), 2);
  assert.equal(calculateLevel(250), 3);

  const prog = calculateLevelProgress(160);
  assert.equal(prog.level, 2);
  assert.equal(prog.xpInCurrentLevel, 60);
  assert.equal(prog.nextLevelXp, 200);
  assert.equal(prog.progressPercent, 60);
});

test("2. awardUserXP awards XP and unlocks Scholar Initiate on first action", async () => {
  const mockUser = {
    _id: "user123",
    xp: 0,
    level: 1,
    streak: 1,
    badges: [],
    lastActiveDate: new Date(),
    save: async function() { return this; }
  };

  User.findById = async () => mockUser;

  const result = await awardUserXP("user123", "flashcards_reviewed");
  assert.equal(result.success, true);
  assert.equal(result.xpGained, 30);
  assert.equal(mockUser.xp, 30);
  assert.equal(mockUser.level, 1);
  assert.equal(result.levelUp, false);
  
  // Scholar initiate + flash prodigy should be awarded
  const badgeIds = mockUser.badges.map(b => b.id);
  assert.ok(badgeIds.includes("scholar_initiate"));
  assert.ok(badgeIds.includes("flash_prodigy"));
});

test("3. awardUserXP awards bonus XP and Quiz Master badge for score >= 80", async () => {
  const mockUser = {
    _id: "user123",
    xp: 40,
    level: 1,
    streak: 1,
    badges: [{ id: "scholar_initiate", name: "Scholar Initiate" }],
    lastActiveDate: new Date(),
    save: async function() { return this; }
  };

  User.findById = async () => mockUser;

  const result = await awardUserXP("user123", "quiz_completed", { score: 90 });
  assert.equal(result.success, true);
  // Base 50 + bonus 25 = 75 XP
  assert.equal(result.xpGained, 75);
  assert.equal(mockUser.xp, 115);
  // 115 XP crosses into Level 2!
  assert.equal(mockUser.level, 2);
  assert.equal(result.levelUp, true);

  const badgeIds = mockUser.badges.map(b => b.id);
  assert.ok(badgeIds.includes("quiz_master"));
});

test("4. awardUserXP does not duplicate existing badges", async () => {
  const mockUser = {
    _id: "user123",
    xp: 200,
    level: 3,
    streak: 2,
    badges: [
      { id: "scholar_initiate", name: "Scholar Initiate" },
      { id: "flash_prodigy", name: "Flashcard Prodigy" }
    ],
    lastActiveDate: new Date(),
    save: async function() { return this; }
  };

  User.findById = async () => mockUser;

  const result = await awardUserXP("user123", "flashcards_reviewed");
  assert.equal(result.newBadges.length, 0);
  const flashBadges = mockUser.badges.filter(b => b.id === "flash_prodigy");
  assert.equal(flashBadges.length, 1);
});

test("5. getUserStats returns complete badge catalog with locked and unlocked flags", async () => {
  const mockUser = {
    _id: "user123",
    xp: 150,
    level: 2,
    streak: 2,
    badges: [{ id: "scholar_initiate", name: "Scholar Initiate", unlockedAt: new Date() }]
  };

  User.findById = async () => mockUser;

  const stats = await getUserStats("user123");
  assert.equal(stats.xp, 150);
  assert.equal(stats.level, 2);
  assert.equal(stats.unlockedCount, 1);
  assert.equal(stats.totalBadgesCount, BADGES_CATALOG.length);
  assert.equal(stats.badges.length, BADGES_CATALOG.length);

  const initiateBadge = stats.badges.find(b => b.id === "scholar_initiate");
  assert.equal(initiateBadge.unlocked, true);

  const quizBadge = stats.badges.find(b => b.id === "quiz_master");
  assert.equal(quizBadge.unlocked, false);
});

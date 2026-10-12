const User = require('../models/User');

const BADGES_CATALOG = [
  {
    id: 'scholar_initiate',
    name: 'Scholar Initiate',
    description: 'Began academic knowledge synthesis on AskMyNotes',
    icon: 'fa-seedling',
    accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  },
  {
    id: 'quiz_master',
    name: 'Quiz Master',
    description: 'Scored 80% or higher on an MCQ practice assessment',
    icon: 'fa-trophy',
    accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  },
  {
    id: 'flash_prodigy',
    name: 'Flashcard Prodigy',
    description: 'Reviewed and flipped an interactive 3D flashcard deck',
    icon: 'fa-bolt',
    accentColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
  },
  {
    id: 'research_scholar',
    name: 'Research Scholar',
    description: 'Executed methodology critique & analysis on a research paper',
    icon: 'fa-microscope',
    accentColor: 'text-violet-400 bg-violet-500/10 border-violet-500/30'
  },
  {
    id: 'executive_briefer',
    name: 'Executive Briefer',
    description: 'Synthesized grounded study summaries from lecture notes',
    icon: 'fa-book-open',
    accentColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
  },
  {
    id: 'streak_champion',
    name: 'Consistency Champion',
    description: 'Maintained a multi-day continuous study streak',
    icon: 'fa-fire',
    accentColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  }
];

const XP_MAP = {
  quiz_completed: 50,
  flashcards_reviewed: 30,
  research_analyzed: 40,
  summary_generated: 25,
  citation_inspected: 15
};

function calculateLevel(xp) {
  return Math.floor((xp || 0) / 100) + 1;
}

function calculateLevelProgress(xp) {
  const currentXp = xp || 0;
  const level = calculateLevel(currentXp);
  const xpInCurrentLevel = currentXp % 100;
  const nextLevelXp = level * 100;
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / 100) * 100));
  return { level, xpInCurrentLevel, nextLevelXp, progressPercent };
}

function updateStreak(user) {
  const now = new Date();
  const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;

  if (!lastActive) {
    user.streak = 1;
    user.lastActiveDate = now;
    return;
  }

  // Calculate day difference
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfLast = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfLast) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day
    user.streak = (user.streak || 0) + 1;
  } else if (diffDays > 1) {
    // Broken streak
    user.streak = 1;
  } else if (diffDays === 0 && !user.streak) {
    user.streak = 1;
  }
  user.lastActiveDate = now;
}

async function awardUserXP(userId, action, metadata = {}) {
  if (!userId) throw new Error('User ID is required');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  updateStreak(user);

  let xpGain = XP_MAP[action] || 15;
  if (action === 'quiz_completed' && Number(metadata.score) >= 80) {
    xpGain += 25; // High score bonus
  }

  const oldLevel = user.level || calculateLevel(user.xp || 0);
  user.xp = (user.xp || 0) + xpGain;
  const newLevel = calculateLevel(user.xp);
  user.level = newLevel;

  const levelUp = newLevel > oldLevel;
  const newBadges = [];

  const existingBadgeIds = new Set((user.badges || []).map(b => b.id));

  function tryAwardBadge(badgeId) {
    if (!existingBadgeIds.has(badgeId)) {
      const badgeInfo = BADGES_CATALOG.find(b => b.id === badgeId);
      if (badgeInfo) {
        user.badges.push({
          id: badgeInfo.id,
          name: badgeInfo.name,
          description: badgeInfo.description,
          icon: badgeInfo.icon,
          unlockedAt: new Date()
        });
        existingBadgeIds.add(badgeId);
        newBadges.push(badgeInfo);
      }
    }
  }

  // Scholar initiate badge
  tryAwardBadge('scholar_initiate');

  if (action === 'quiz_completed' && Number(metadata.score) >= 80) {
    tryAwardBadge('quiz_master');
  }

  if (action === 'flashcards_reviewed') {
    tryAwardBadge('flash_prodigy');
  }

  if (action === 'research_analyzed') {
    tryAwardBadge('research_scholar');
  }

  if (action === 'summary_generated') {
    tryAwardBadge('executive_briefer');
  }

  if ((user.streak || 1) >= 3) {
    tryAwardBadge('streak_champion');
  }

  await user.save();

  const progress = calculateLevelProgress(user.xp);

  return {
    success: true,
    xpGained: xpGain,
    totalXp: user.xp,
    level: user.level,
    levelUp,
    streak: user.streak,
    newBadges,
    progress
  };
}

async function getUserStats(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const progress = calculateLevelProgress(user.xp || 0);
  const unlockedMap = new Map((user.badges || []).map(b => [b.id, b]));

  const badges = BADGES_CATALOG.map(badge => {
    const isUnlocked = unlockedMap.has(badge.id);
    const existing = unlockedMap.get(badge.id);
    return {
      ...badge,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked ? existing.unlockedAt : null
    };
  });

  return {
    xp: user.xp || 0,
    level: user.level || progress.level,
    streak: user.streak || 1,
    lastActiveDate: user.lastActiveDate,
    progress,
    badges,
    unlockedCount: user.badges ? user.badges.length : 0,
    totalBadgesCount: BADGES_CATALOG.length
  };
}

module.exports = {
  BADGES_CATALOG,
  XP_MAP,
  calculateLevel,
  calculateLevelProgress,
  awardUserXP,
  getUserStats
};

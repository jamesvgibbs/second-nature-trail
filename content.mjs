// Server-only authored content. Public projections deliberately omit answer keys.
export const RULES = Object.freeze({
  version: "trail-0.3.0-draft",
  contentApproved: false,
  chapterMs: 300000,
  breakMs: 120000,
  countdownMs: 10000,
  finaleMs: 240000,
  awardsMs: 600000,
  capacity: 100,
  storageLimit: 12,
  moveSpeed: 190,
  tradeMaxQuantity: 3,
  assistDistance: 180,
  interactionDistance: 110,
  siteDistance: 65,
  finaleParticipationRatio: 0.6,
  spatialOffsets: { 1: 1, 2: 2, 3: 0, 6: 4 },
  targetPattern: [1, 0, 2],
  targetLabels: ["Target A", "Target B", "Target C"],
  deliveryCheckpoints: {
    scenic: { name: "Paved detour", x: 230, y: 60 },
    shortcut: { name: "Rubble shortcut", x: 230, y: 160 },
  },
  budgetIncompletePayment: 20,
  rewards: {
    perJob: 2,
    projects: [
      {
        id: "garden",
        label: "Build a community garden",
        cost: 4,
        outcome: "Your reward planted a garden bed for the neighborhood.",
      },
      {
        id: "welcome",
        label: "Open a welcome station",
        cost: 8,
        outcome: "Your reward stocked a welcome station for new neighbors.",
      },
      {
        id: "festival",
        label: "Host a neighborhood celebration",
        cost: 12,
        outcome: "Your reward brought a celebration stage to Bragging Square.",
      },
    ],
  },
  routing: {
    source: "exchange",
    destinations: ["home-a", "home-b", "home-c"],
    maxNodes: 10,
    sites: [
      { name: "Maple home network station", x: 160, y: 160 },
      { name: "Cedar home network station", x: 930, y: 150 },
      { name: "Oak home network station", x: 160, y: 630 },
    ],
    nodes: [
      { id: "exchange", label: "Exchange", x: 0, y: 1 },
      { id: "north", label: "North junction", x: 1, y: 0 },
      { id: "south", label: "South junction", x: 1, y: 2 },
      { id: "relay-west", label: "West relay", x: 2, y: 0 },
      { id: "relay-east", label: "East relay", x: 2, y: 2 },
      { id: "hub", label: "Neighborhood hub", x: 3, y: 1 },
      { id: "bypass", label: "Bypass", x: 3, y: 0 },
      { id: "home-a", label: "Home A", x: 4, y: 0 },
      { id: "home-b", label: "Home B", x: 4, y: 1 },
      { id: "home-c", label: "Home C", x: 4, y: 2 },
    ],
    edgeCosts: [
      { from: "exchange", to: "north", cost: 2 },
      { from: "exchange", to: "south", cost: 2 },
      { from: "north", to: "relay-west", cost: 2 },
      { from: "south", to: "relay-east", cost: 2 },
      { from: "relay-west", to: "hub", cost: 2 },
      { from: "relay-east", to: "hub", cost: 2 },
      { from: "relay-west", to: "bypass", cost: 1 },
      { from: "bypass", to: "home-a", cost: 3 },
      { from: "hub", to: "home-a", cost: 2 },
      { from: "hub", to: "home-b", cost: 2 },
      { from: "hub", to: "home-c", cost: 2 },
      { from: "relay-east", to: "home-c", cost: 4 },
      { from: "north", to: "south", cost: 4 },
      { from: "bypass", to: "hub", cost: 3 },
      { from: "relay-east", to: "bypass", cost: 5 },
    ],
    blockedVariants: [
      [["hub", "home-a"]],
      [["relay-west", "hub"]],
      [["exchange", "north"]],
    ],
    requiredNodes: [["relay-west"], ["relay-east"], ["relay-west", "hub"]],
    budgets: [9, 9, 12],
  },
  taskCooldownMs: 3000,
  spatialTaskCount: 6,
  spatialTaskPoints: 10,
  targetRoundMs: 9000,
  targetTelegraphMs: 2000,
  targetHitsPerSite: 6,
  targetSites: [
    { name: "Apartment block outbreak", x: 920, y: 370 },
    { name: "Maple home outbreak", x: 160, y: 160 },
    { name: "Elm home outbreak", x: 530, y: 650 },
  ],
  deliveryDamage: 2,
  cargoSlots: 4,
  cargoWeights: { parts: 2, food: 1, cable: 2 },
  reservePerChapter: 6,
  cargoPlans: [{ parts: 2 }, { parts: 1, food: 2 }, { cable: 2 }],
  cargoPlanLabels: ["Repair kit", "Essentials", "Connection kit"],
  budgetCycleMs: 45000,
  chapterMaxima: [95, 95, 95, 95, 95, 95, 95, 95],
  budgetIncomes: [100, 90, 80],
  budgetDues: [60, 50, 50],
  optionalExpense: 20,
  values: { parts: 5, filters: 4, food: 3, cable: 6 },
  allocation: { parts: 3, filters: 3, food: 3, cable: 3 },
  taskPoints: 20,
  mistakePenalty: 5,
  challengePoints: 10,
  quizPoints: 10,
  assistPoints: 5,
  maxChapterScore: 95,
  emotes: ["Wave", "Cheer", "Thanks", "Thinking", "Ready", "Robot dance"],
  helpPresets: ["Help with my task", "Trade supplies", "Show me the way"],
  tutorial: ["move", "interact", "collect", "answer", "help"],
  ties: "Chapter: fewer mistakes (Credit: retained budget), then seeded draw. Hoarder: more completed objectives. Trailblazer: higher total score. Hero: more distinct recipients. Intelligence: more completed objectives. Discovery: more completed objectives. Trader: more consumed supplied items. Survivor: more completed objectives. Exact ties use a recorded seeded draw.",
  fallback:
    "No qualifying candidate: leave prize unawarded. Never award an employee twice.",
  thresholds: {
    chapter: "complete main objective",
    hoarder: "complete one main objective",
    trailblazer: "complete every ranked objective",
    hero: "one confirmed assist",
    intelligence: "one correct first answer",
    discovery: "one secret",
    trader: "one recipient consumes a supplied item in a required task",
    survivor: "complete one main objective",
  },
  fiction:
    "Insurance, budgets, and credit outcomes are fictional game models. Trading does not improve real credit.",
});
const task = (prompt, options, answer, item, kind = "deduction") => ({
  prompt,
  options,
  answer,
  item,
  kind,
});
const quiz = (prompt, options, answer, explanation) => ({
  prompt,
  options,
  answer,
  explanation,
});
export const CHAPTERS = [
  {
    title: "Move day mayhem",
    objective:
      "Load a twelve-slot cart and deliver three useful supplies. The scenic route protects cargo; shortcuts can damage it.",
    locations: [
      { name: "Moving depot", x: 160, y: 160 },
      { name: "Broken highway", x: 300, y: 160 },
    ],
    tasks: [
      task(
        "Your cart is full. Which route protects the repair parts?",
        ["Paved detour", "Rubble shortcut", "Ask the GPS to become a bridge"],
        0,
        "parts",
        "delivery",
      ),
      task(
        "A neighbor needs dinner supplies. What should you deliver?",
        [
          "A decorative traffic cone",
          "Food from the cart",
          "An empty instruction manual",
        ],
        1,
        "food",
        "delivery",
      ),
      task(
        "The final home needs a connection. Choose the useful cargo.",
        [
          "A motivational poster",
          "A duplicate road sign",
          "A cable from your cart",
        ],
        2,
        "cable",
        "delivery",
      ),
    ],
    challenge: task(
      "One safe cart route remains: depot → bridge → homes. The bridge allows only two units at once. What works?",
      [
        "Carry three and hope",
        "Two trips with at most two units",
        "Throw cargo across",
      ],
      1,
    ),
    questions: [
      quiz(
        "Before a move, what is the useful first step?",
        [
          "Plan the essential services and supplies",
          "Wait until everything breaks",
          "Share every password",
        ],
        0,
        "Planning essential services reduces last-minute friction. Confirm the actual services offered in your resident package.",
      ),
      quiz(
        "Does a resident benefits package mean every household has identical services?",
        ["Always", "No; confirm the actual package", "Only on Tuesdays"],
        1,
        "Benefits and availability depend on the actual package. Check its details.",
      ),
    ],
    clue: "N",
    secretHint: "The highway sign has a suspiciously polite sticker.",
  },
  {
    title: "The great filter shortage",
    objective:
      "Match three filters to their labeled vents and restore airflow.",
    locations: [
      { name: "Filter warehouse", x: 530, y: 140 },
      { name: "Ventilation maze", x: 680, y: 140 },
    ],
    tasks: [
      task(
        "Vent A is labeled 16 × 20. Which filter fits?",
        ["20 × 25", "16 × 20", "Any size if folded"],
        1,
        "filters",
        "matching",
      ),
      task(
        "Vent B points airflow toward the unit. Where should the arrow point?",
        ["Toward the unit", "Away from the unit", "At the nearest robot"],
        0,
        "filters",
        "matching",
      ),
      task(
        "Vent C needs a clean replacement. Choose your action.",
        [
          "Paint the old filter",
          "Stack three filters",
          "Install the matching clean filter",
        ],
        2,
        "filters",
        "matching",
      ),
    ],
    challenge: task(
      "Two boxes have swapped labels. Measure the first filter, then…",
      [
        "Trust the wrong sticker",
        "Match dimensions to the vent before installing",
        "Install both at once",
      ],
      1,
    ),
    questions: [
      quiz(
        "What should a resident check before installing a filter?",
        [
          "Its color only",
          "The required size and airflow direction",
          "The shipping robot’s opinion",
        ],
        1,
        "Use the required filter dimensions and installation direction for the equipment.",
      ),
      quiz(
        "Does having a delivery remove the need to replace the old filter?",
        [
          "No; the replacement still needs installation",
          "Yes",
          "Only if the box is shiny",
        ],
        0,
        "A delivered filter still needs to be installed. Follow the equipment guidance.",
      ),
    ],
    clue: "E",
    secretHint: "A warehouse shelf is labeled “air guitars only.”",
  },
  {
    title: "Attack of the clones",
    objective:
      "Investigate three messages without accusing legitimate neighbors.",
    locations: [
      { name: "Identity bureau", x: 930, y: 150 },
      { name: "Counterfeit town hall", x: 1080, y: 150 },
    ],
    tasks: [
      task(
        "A message demands your password to prevent immediate eviction. Your move?",
        [
          "Reply with your password",
          "Verify through a known official channel",
          "Forward it to everyone",
        ],
        1,
        "parts",
      ),
      task(
        "A neighbor uses the official portal to request a repair. Verdict?",
        [
          "Legitimate channel; verify the request normally",
          "Definitely an impersonator",
          "Send them your login",
        ],
        0,
        "parts",
      ),
      task(
        "A caller requests an urgent gift-card payment. What now?",
        [
          "Buy the cards",
          "Give remote access",
          "Stop and independently verify",
        ],
        2,
        "parts",
      ),
    ],
    challenge: task(
      "The sender name matches, but the reply address differs by one letter. What is the strongest check?",
      [
        "The friendly tone",
        "Contact the organization through a known channel",
        "The logo",
      ],
      1,
    ),
    questions: [
      quiz(
        "What is a safe response to a suspected impersonation?",
        [
          "Use the number in the suspicious message",
          "Verify using a trusted contact method",
          "Share your password to prove identity",
        ],
        1,
        "Verify requests through a trusted channel you already know.",
      ),
      quiz(
        "Can identity protection prevent every scam?",
        [
          "Yes, always",
          "Only on weekdays",
          "No; residents still need safe habits",
        ],
        2,
        "Protection services do not eliminate every risk. Confirm the actual services and reporting steps in the package.",
      ),
    ],
    clue: "I",
    secretHint: "Town hall has issued itself a certificate of authenticity.",
  },
  {
    title: "RIP, my apartment",
    objective: "Prepare a fictional home and choose sensible recovery actions.",
    locations: [
      { name: "Insurance office", x: 170, y: 370 },
      { name: "Disaster block", x: 310, y: 370 },
    ],
    tasks: [
      task(
        "Before the fictional leak, what helps document belongings?",
        [
          "An inventory and photos",
          "A list of favorite songs",
          "A drawing of a duck",
        ],
        0,
        "food",
      ),
      task(
        "Water reaches an electrical outlet. First action?",
        [
          "Touch the outlet",
          "Keep clear and contact the appropriate emergency support",
          "Ask the water to leave",
        ],
        1,
        "parts",
      ),
      task(
        "The home is safe again. What supports a fictional claim?",
        [
          "Invent a bigger loss",
          "Throw out every record",
          "Document damage and follow the policy process",
        ],
        2,
        "cable",
      ),
    ],
    challenge: task(
      "A fictional policy has an exclusion and a deductible. What determines this claim?",
      [
        "The loudest robot",
        "The policy terms and actual circumstances",
        "Who clicks fastest",
      ],
      1,
    ),
    questions: [
      quiz(
        "Is every kind of loss automatically covered?",
        [
          "No; coverage depends on policy terms",
          "Yes",
          "Only if you say “insurance” three times",
        ],
        0,
        "Coverage depends on the policy, exclusions, limits, and circumstances. This game does not decide real claims.",
      ),
      quiz(
        "What should a resident consult for actual coverage?",
        [
          "The game score",
          "The actual policy and provider",
          "A neighbor’s guess",
        ],
        1,
        "Use the actual policy and provider for coverage questions. All game outcomes are fictional.",
      ),
    ],
    clue: "G",
    secretHint: "A soggy robot is filing a claim for emotional rust.",
  },
  {
    title: "Pest resistance",
    objective:
      "Visit three outbreak sites and resolve six marked targets at each. Read the warning signal, select deliberately, and leave friendly targets alone.",
    locations: [
      { name: "Apartment block", x: 920, y: 370 },
      { name: "Pest-control HQ", x: 1070, y: 370 },
    ],
    tasks: [
      task(
        "Outbreak 1: the red warning marker is on target B. Select the marked target.",
        [
          "Target A: friendly courier",
          "Target B: outbreak",
          "Target C: neighbor",
        ],
        1,
        "parts",
        "targeting",
      ),
      task(
        "Outbreak 2: the red warning marker is on target A. Select the marked target.",
        [
          "Target A: outbreak",
          "Target B: friendly courier",
          "Target C: neighbor",
        ],
        0,
        "parts",
        "targeting",
      ),
      task(
        "Outbreak 3: the red warning marker is on target C. Select the marked target.",
        [
          "Target A: neighbor",
          "Target B: friendly courier",
          "Target C: outbreak",
        ],
        2,
        "parts",
        "targeting",
      ),
    ],
    challenge: task(
      "Two targets carry warning markers, but one is a decoy hologram. The solid target casts a square shadow. Choose it.",
      [
        "Hologram with no shadow",
        "Solid marked target",
        "Friendly maintenance robot",
      ],
      1,
    ),
    questions: [
      quiz(
        "What is useful when reporting a pest issue?",
        [
          "A clear description and location",
          "A guess presented as certainty",
          "Only a dramatic soundtrack",
        ],
        0,
        "Describe the issue and location, then follow the actual reporting process.",
      ),
      quiz(
        "Does a pest benefit mean every service is available everywhere?",
        [
          "Yes",
          "No; confirm the package and service terms",
          "Only in the game",
        ],
        1,
        "Availability and service terms must be checked for the actual benefit. Replacement visuals do not change gameplay.",
      ),
    ],
    clue: "H",
    secretHint: "HQ has a tiny “robots welcome” door.",
  },
  {
    title: "Credit where it’s due",
    objective:
      "Plan three fictional payment cycles. Your activity budget cannot be traded.",
    locations: [
      { name: "Trading post", x: 160, y: 630 },
      { name: "Payment station", x: 310, y: 630 },
    ],
    tasks: [
      task(
        "Cycle 1: budget 100, payment due 60. Choose a plan.",
        [
          "Pay 60 on time; retain 40",
          "Spend 80 on confetti",
          "Ignore the date",
        ],
        0,
        "food",
        "budget",
      ),
      task(
        "Cycle 2: budget 90, payment due 50. What protects the payment?",
        [
          "Trade imaginary credit points",
          "Reserve 50 before optional spending",
          "Buy 90 worth of stickers",
        ],
        1,
        "food",
        "budget",
      ),
      task(
        "Cycle 3: budget 80, payment due 50. Finish the cycle.",
        [
          "Miss the deadline",
          "Pay a stranger who promises magic credit",
          "Pay 50 on time; retain 30",
        ],
        2,
        "food",
        "budget",
      ),
    ],
    challenge: task(
      "Budget 100, required payment 70, optional purchase 40. Choose a feasible plan.",
      [
        "Pay 70 and defer the purchase",
        "Spend 110",
        "Trade a cable to erase real debt",
      ],
      0,
    ),
    questions: [
      quiz(
        "Does trading supplies in this game improve real credit?",
        ["Yes", "No", "Only a gold cable does"],
        1,
        "Game trading has no effect on real credit or financial accounts.",
      ),
      quiz(
        "What should a resident check about a credit-building benefit?",
        [
          "Its actual reporting terms and eligibility",
          "The game leaderboard",
          "Whether a robot likes them",
        ],
        0,
        "Check the actual benefit terms and eligibility. Game payment cycles are fictional and do not predict credit outcomes.",
      ),
    ],
    clue: "B",
    secretHint:
      "The payment station accepts exactly zero compliments as currency.",
  },
  {
    title: "Rewards rebellion",
    objective:
      "Complete three distinct resident challenges and choose useful rewards.",
    locations: [
      { name: "Rewards arcade", x: 530, y: 650 },
      { name: "Night market", x: 680, y: 650 },
    ],
    tasks: [
      task(
        "Challenge: the arcade needs power. Deliver the useful supply.",
        ["Food wrapper", "Cable", "A speech about electricity"],
        1,
        "cable",
        "delivery",
      ),
      task(
        "Challenge: the market has a broken sign. What repairs it?",
        [
          "Repair parts",
          "More error messages",
          "A coupon for another broken sign",
        ],
        0,
        "parts",
        "delivery",
      ),
      task(
        "Challenge: volunteers need a break. What helps?",
        ["A mandatory dance", "A longer queue", "Food supplies"],
        2,
        "food",
        "delivery",
      ),
    ],
    challenge: task(
      "A reward expires before your planned use. What is sensible?",
      [
        "Read the terms and choose a usable reward",
        "Ignore the date",
        "Demand the game change reality",
      ],
      0,
    ),
    questions: [
      quiz(
        "What should someone read before redeeming a reward?",
        [
          "The eligibility and redemption terms",
          "Only the biggest headline",
          "The robot’s horoscope",
        ],
        0,
        "Read the actual eligibility, availability, and redemption terms.",
      ),
      quiz(
        "Are game rewards real purchases or cash?",
        ["Yes", "No; these are fictional game rewards", "Only if you win"],
        1,
        "The game does not make real purchases or create financial rewards. Event prizes are handled separately by the organizer.",
      ),
    ],
    clue: "O",
    secretHint: "The market sells a coupon for one free coupon.",
  },
  {
    title: "Reconnect humanity",
    objective: "Route three homes back onto the neighborhood network.",
    locations: [
      { name: "Internet exchange", x: 930, y: 630 },
      { name: "AI headquarters", x: 1080, y: 630 },
    ],
    tasks: [
      task(
        "Home A path: exchange → relay → home. Which segment completes it?",
        [
          "Relay to home",
          "Home to decorative fountain",
          "Exchange back to itself",
        ],
        0,
        "cable",
        "routing",
      ),
      task(
        "Home B has a broken direct link. Choose the valid route.",
        [
          "Use the broken link",
          "Exchange → working relay → home",
          "Connect to a cardboard cloud",
        ],
        1,
        "cable",
        "routing",
      ),
      task(
        "Home C needs one final cable. Which endpoint is correct?",
        [
          "The AI’s suggestion box",
          "A disconnected sign",
          "The home’s labeled network port",
        ],
        2,
        "cable",
        "routing",
      ),
    ],
    challenge: task(
      "Two homes share one working relay. Which plan avoids a loop?",
      [
        "Relay A → B → A forever",
        "Exchange → relay, then one branch to each home",
        "Connect nothing and declare victory",
      ],
      1,
    ),
    questions: [
      quiz(
        "When choosing internet service, what should a resident confirm?",
        [
          "Availability, setup steps, and actual terms",
          "Only a fictional speed score",
          "Whether the router is photogenic",
        ],
        0,
        "Confirm availability and actual service terms for the home.",
      ),
      quiz(
        "What is the point of this neighborhood’s benefits?",
        [
          "Replace every resident decision",
          "Help address everyday resident needs",
          "Give an AI ownership of the neighborhood",
        ],
        1,
        "The game illustrates everyday resident needs. Actual benefits and terms require confirmation with the package provider.",
      ),
    ],
    clue: "R",
    secretHint: "The AI’s password hint is “please do not guess neighbor.”",
  },
];
export function publicChapter(index, progress) {
  const c = CHAPTERS[index];
  if (!c) return null;
  const strip = ({ answer, item, explanation, falseAccusations, ...v }) => v;
  return {
    index,
    title: c.title,
    taskCount: c.tasks.length,
    objective: c.objective,
    locations: c.locations,
    task: progress?.complete
      ? null
      : { ...strip(c.tasks[progress?.step || 0]), step: progress?.step || 0 },
    challenge: strip(c.challenge),
    questions: c.questions.map(strip),
    secretHint: c.secretHint,
  };
}

// Six authored stops per spatial objective. Evidence is revealed by inspecting the site.
export const SPATIAL_CHAPTERS = [1, 2, 3, 6];
export const ACTIVITY_STOPS = [
  { name: "Maple home", x: 160, y: 160 },
  { name: "Juniper home", x: 530, y: 140 },
  { name: "Cedar home", x: 930, y: 150 },
  { name: "Willow home", x: 920, y: 370 },
  { name: "Elm home", x: 530, y: 650 },
  { name: "Oak home", x: 160, y: 630 },
];
CHAPTERS[1].tasks.push(
  task(
    "This home needs a 20 × 25 filter. Which installation matches the inspected unit?",
    [
      "20 × 25, arrow toward unit",
      "16 × 20, packed with paper",
      "20 × 25, arrow away",
    ],
    0,
    "filters",
    "matching",
  ),
  task(
    "The resident says airflow became weak after two filters were stacked. What restores the intended setup?",
    [
      "Add a third filter",
      "Use one correctly sized filter as specified",
      "Remove the filter permanently",
    ],
    1,
    "filters",
    "matching",
  ),
  task(
    "The final vent label and replacement carton disagree. What do you install?",
    [
      "Whatever arrived first",
      "The largest filter available",
      "A clean replacement matching the inspected equipment label",
    ],
    2,
    "filters",
    "matching",
  ),
);
CHAPTERS[1].tasks.forEach(
  (t, i) =>
    (t.evidence = [
      "Equipment plate: 16 × 20. The delivered box contains three different sizes; the vent plate is the installation reference.",
      "A painted arrow on the duct points toward the equipment. The filter frame also carries an airflow arrow.",
      "The old filter is visibly loaded with dust. A sealed replacement matches the equipment plate.",
      "Equipment plate: 20 × 25. The fan draws air from the return vent into the unit.",
      "Equipment guide: one filter in this slot. Two overlapping frames are obstructing the slot.",
      "Equipment plate: 16 × 20. The outer carton says 20 × 25, but the sealed replacement inside is labeled 16 × 20.",
    ][i]),
);
CHAPTERS[2].tasks.push(
  task(
    "The message says a service appointment changed. Based on your evidence, what is the appropriate verdict?",
    [
      "Verified notice; use the known portal to respond",
      "Accuse the resident of impersonation",
      "Send your password by reply",
    ],
    0,
    "parts",
    "investigation",
  ),
  task(
    "A QR sticker promises a refund. Which response follows the evidence?",
    [
      "Scan it and enter payment details",
      "Treat it as suspicious; report through the known channel",
      "Pay a small verification fee",
    ],
    1,
    "parts",
    "investigation",
  ),
  task(
    "A maintenance message asks you to confirm a window through the official portal. Your verdict?",
    [
      "Fake because it uses an ordinary greeting",
      "Fake because a human made a typo",
      "Verified channel; confirm through the portal",
    ],
    2,
    "parts",
    "investigation",
  ),
);
CHAPTERS[2].tasks.forEach(
  (t, i) =>
    (t.evidence = [
      "The sender address has a one-letter domain substitution. The request asks for a password, and the official portal shows no urgent notice.",
      "The request appears inside the known official portal. Its repair reference matches the resident’s previously submitted request.",
      "The caller refuses a callback through the known office number and demands gift cards. No payment is shown in the official portal.",
      "The appointment reference matches the known portal. You independently reached the office using its saved number and confirmed the change.",
      "The QR sticker was pasted over the original sign. Its destination is an unrelated domain, and the office has no refund campaign.",
      "The message directs you to open the portal yourself rather than follow a new link. The appointment is listed there with the matching reference.",
    ][i]),
);
CHAPTERS[3].tasks.push(
  task(
    "A fictional windstorm damaged the roof. What comes before documenting belongings inside?",
    [
      "Confirm the area is safe and follow emergency guidance",
      "Rush under the damaged roof",
      "Let the AI certify safety from a photograph",
    ],
    0,
    "parts",
    "recovery",
  ),
  task(
    "The fictional provider requests supporting records for damaged items. What do you submit?",
    [
      "A new shopping wish list",
      "The inventory, photos, and requested records",
      "Someone else’s receipts",
    ],
    1,
    "food",
    "recovery",
  ),
  task(
    "The fictional policy lists a limit, a deductible, and an exclusion. What determines the recovery plan?",
    [
      "Your game rank",
      "How loudly the robot complains",
      "The actual terms and the documented loss",
    ],
    2,
    "cable",
    "recovery",
  ),
);
CHAPTERS[3].tasks.forEach(
  (t, i) =>
    (t.evidence = [
      "Preparation visit: the home is safe. The resident has belongings but no record of them. The robot’s only backup is a picture of itself.",
      "Fictional leak: water is spreading toward an electrical outlet. The resident is safely outside the affected room.",
      "Recovery visit: the immediate hazard is resolved. Photos and purchase records are available; the fictional provider has a reporting process.",
      "Fictional storm: roofing material is loose above the doorway. A robot has put up a sign saying “probably fine.”",
      "Recovery checklist: identify the affected belongings, describe damage, and provide the requested supporting documentation.",
      "Fictional policy summary: covered loss categories, exclusions, a deductible, and a payment limit. The game cannot decide any real claim.",
    ][i]),
);
CHAPTERS[6].tasks.push(
  task(
    "The inspection found a damaged market stall. Complete the distinct repair job.",
    [
      "Use repair parts on the broken support",
      "Submit the arcade power job again",
      "Redeem a fictional reward without checking it",
    ],
    0,
    "parts",
    "delivery",
  ),
  task(
    "The community notice board needs a working link. Which delivery completes this job?",
    [
      "A spare lunch",
      "A cable for the labeled connection",
      "A duplicate completion receipt",
    ],
    1,
    "cable",
    "delivery",
  ),
  task(
    "The final volunteer shift needs supplies. Which action completes the last unique challenge?",
    [
      "Repeat your first task for another reward",
      "Trade imaginary credit points",
      "Deliver food, then read the fictional reward terms",
    ],
    2,
    "food",
    "delivery",
  ),
);
CHAPTERS[6].tasks.forEach(
  (t, i) =>
    (t.evidence = [
      "Work order ARCADE-1: power connection missing. This is a new job, not a repeat claim. A cable is required.",
      "Work order MARKET-2: a cracked sign bracket needs repair parts. The arcade job cannot be submitted again for this reward.",
      "Work order VOLUNTEER-3: volunteers need food supplies. This is a separate challenge with its own completion record.",
      "Work order STALL-4: a support bracket is broken. Completing this task adds one distinct challenge, regardless of earlier jobs.",
      "Work order NOTICE-5: a labeled connection is empty. The fictional reward expires after this event and has no cash value.",
      "Work order SHIFT-6: the final volunteer team needs food. Fictional reward terms: one claim per completed unique job; no real purchases.",
    ][i]),
);

// Server-only classification metadata. Never expose before a scored decision.
CHAPTERS[2].tasks.forEach(
  (t, i) => (t.falseAccusations = [[], [1], [], [1], [], [0, 1]][i]),
);
CHAPTERS[0].objective =
  "Pack a four-slot delivery cart from your twelve-item storage. Complete three deliveries, choosing between protected cargo and the shorter damaged route.";
CHAPTERS[1].objective =
  "Inspect six homes, match each replacement to its equipment, and restore airflow.";
CHAPTERS[2].objective =
  "Investigate evidence at six homes. Identify impersonation attempts without falsely accusing legitimate neighbors.";
CHAPTERS[6].objective =
  "Complete six distinct resident jobs, earn fictional reward tokens, then decide how to use them for neighborhood projects.";
CHAPTERS[6].tasks.push({
  kind: "rewards",
  prompt: "Use your earned fictional rewards for a neighborhood project.",
  options: RULES.rewards.projects.map((p) => p.label),
  item: null,
  answer: null,
});

export const MYSTERY = {
  answer: "NEIGHBOR",
  requiredClues: 8,
  successLine: "The AI forgot its most important variable: a neighbor.",
};

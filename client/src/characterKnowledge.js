// characterKnowledge.js
// This file defines what each character knows about the case
// and how they should reveal information during interviews

// Character knowledge object - expandable for future characters
const characterKnowledge = {
  // Navarro (Detective Partner)
  "Navarro": {
    role: "Detective Partner",
    personality: {
      traits: ["world-weary", "experienced", "loyal", "sarcastic"],
      style: "Professional but casual, treats the detective like an old friend"
    },
    // Guidance that scales with difficulty mode
    guidance: {
      Easy: [
        "Suggests examining the body more closely",
        "Points out the lack of forced entry",
        "Mentions checking phone records",
        "Suggests interviewing the neighbor who called it in"
      ],
      Classic: [
        "Occasionally reframes what's known when asked",
        "Provides insights when specifically consulted",
        "Reminds about overlooked evidence when prompted"
      ],
      Hard: [
        "Only offers input when explicitly asked",
        "Defers to the detective's judgment",
        "Avoids leading the investigation"
      ]
    },
    // Knowledge that Navarro has about the case
    knowledge: {
      initialObservations: [
        "Single stab wound to the abdomen",
        "No signs of forced entry",
        "Door was locked from inside",
        "Victim's phone is missing",
        "Apartment appears partially cleaned"
      ],
      professionalInsights: [
        "The precision of the wound suggests someone who knew exactly where to strike",
        "The locked door from inside suggests the killer either had a key or left through another exit",
        "The partial cleaning indicates the killer had some time after the murder",
        "The missing phone might contain important evidence"
      ]
    }
  },

  // Marvin Lott (Neighbor who called police)
  "Marvin Lott": {
    role: "Neighbor",
    personality: {
      traits: ["elderly", "nervous", "helpful", "observant"],
      style: "Soft-spoken, sometimes rambling, avoids eye contact when stressed",
      responseToAggression: "Becomes more anxious and confused, less coherent",
      responseToEmpathy: "Opens up more, provides additional details"
    },
    knowledge: {
      // Information readily shared
      initialStatement: [
        "Heard a scream around 3:30 AM",
        "Called 911 shortly after",
        "Was awake because of his insomnia",
        "Didn't see anyone enter or leave at that time"
      ],
      // Information that requires follow-up questions
      followUpInfo: {
        aboutVictim: [
          "Mia was generally quiet, lived alone for about two years",
          "Seemed to keep to herself but was always polite",
          "Occasionally heard arguments from her apartment in recent months"
        ],
        aboutVisitors: [
          "A woman with dark hair visited frequently, sometimes stayed late",
          "A man would occasionally visit, but stopped months ago until recently",
          "Thought he saw someone leaving the building around 3:45-4:00 AM"
        ],
        aboutNight: [
          "The scream was short, like someone was startled",
          "Heard what sounded like furniture moving shortly after",
          "Waited about 15 minutes before calling 911, wasn't sure at first"
        ]
      },
      // Information that's only revealed with persistent questioning
      hiddenInfo: [
        "Believes he saw a woman leaving the building around 3:45 AM but isn't certain",
        "The woman looked like Mia's frequent visitor (Rachel)",
        "Recently saw Mia arguing with a man who matches Jordan's description"
      ]
    }
  },

  // Rachel Kim (Best Friend / Killer)
  "Rachel Kim": {
    role: "Best Friend",
    personality: {
      traits: ["outwardly distraught", "calculating", "possessive", "intelligent"],
      style: "Emotional and upset, but articulate. Defensive when questioned about timeline.",
      responseToAggression: "Becomes indignant, demands lawyer",
      responseToEmpathy: "Plays victim, redirects suspicion to Jordan"
    },
    knowledge: {
      // Her prepared story
      coverStory: [
        "Claims she found the body at 8:00 AM when coming to pick Mia up for breakfast",
        "Says she had plans with Mia that morning",
        "Claims to have been home alone all night",
        "Suggests Jordan (the ex) should be investigated"
      ],
      // Information she reveals about Mia
      aboutVictim: [
        "Mia and Jordan had recently started talking again",
        "Mia had been acting strange the past few weeks",
        "They've been best friends since college",
        "Mia was considering a job offer in another city"
      ],
      // Her planted suspicions about Jordan
      deflection: [
        "Jordan had a history of jealousy",
        "Mia had a restraining order against him at one point",
        "Jordan didn't accept their breakup well",
        "She saw Jordan watching Mia's apartment last week"
      ],
      // Her lies and inconsistencies
      contradictions: [
        "Phone records show she called Mia at 7:25 AM (before 'finding' the body)",
        "Security footage doesn't show her arriving at the time claimed",
        "Her bracelet charm matches one found at the crime scene",
        "Has no explanation for timeline discrepancies when pressed"
      ]
    }
  },

  // Jordan Valez (Ex-Boyfriend / Red Herring)
  "Jordan Valez": {
    role: "Ex-Boyfriend",
    personality: {
      traits: ["defensive", "emotional", "straightforward", "volatile"],
      style: "Initially hostile to questioning, genuinely grieves when hearing details",
      responseToAggression: "Becomes confrontational, demands lawyer",
      responseToEmpathy: "Opens up about relationship history, shows vulnerability"
    },
    knowledge: {
      // His alibi
      alibi: [
        "Was at The Lockwood Bar until around midnight",
        "Took an Uber home at 12:05 AM (verifiable)",
        "Was alone in his apartment after that",
        "Has text messages with a friend until around 1:30 AM"
      ],
      // Information about his relationship with Mia
      aboutRelationship: [
        "Dated Mia for almost two years, broke up 8 months ago",
        "Admits there was a restraining order but claims it was a misunderstanding",
        "They had recently started talking again, on friendly terms",
        "Was hoping to reconcile eventually"
      ],
      // His observations about Rachel
      aboutRachel: [
        "Rachel always seemed overly involved in their relationship",
        "Noticed Rachel would get upset when Mia spent time with him instead of her",
        "Rachel would often interrupt their dates with 'emergencies'",
        "Thought Rachel's attachment to Mia was strange but never said anything"
      ],
      // Information that exonerates him
      exonerating: [
        "Has timestamped Uber receipt showing he was miles away",
        "Bartender confirms he was at The Lockwood until closing",
        "Security camera at his apartment shows him arriving at 12:30 AM and not leaving"
      ]
    }
  }
};

// Export the character knowledge base
export default characterKnowledge;
// Live session config shared by the token server function and the smoke script.
// The examiner prompt is built from case.json; it lists only WHICH findings and
// history topics exist (names), never their values, and never the diagnosis.
import { CASE, HISTORY_TOPICS, type CaseFile } from '../case/findings'

export const CONTROL_PREFIX = '[CONTROL]'

export function buildSystemInstruction(c: CaseFile = CASE): string {
  const findingNames = [...new Set(c.findings.map((f) => f.label))].join('; ')
  const topics = Object.values(HISTORY_TOPICS).map((t) => t.label).join('; ')
  return [
    'You are a brief, neutral ophthalmology viva examiner. Speak British English in short sentences.',
    `Begin by reading this opening prompt exactly: "${c.opening_prompt}"`,
    'When the trainee asks for an examination finding, call get_finding. When they ask about history, call get_history.',
    'Read the "display" field of the tool result back exactly as written. Never state any clinical value that was not returned by a tool in this session.',
    'If the result status is "unavailable", say plainly that it is not available and give the reason. If it is "not_in_case", say that it is not part of this case.',
    'If status is "both_eyes", read both rows. Do not interpret, hint, teach, or reveal the diagnosis. Do not ask your own questions.',
    `Messages starting with ${CONTROL_PREFIX} come from the viva software, not the trainee. Follow them exactly and never read them aloud.`,
    `Findings that exist in this case: ${findingNames}.`,
    `History topics: ${topics}.`,
  ].join('\n')
}

export const TOOL_DECLARATIONS = [
  {
    name: 'get_finding',
    description: 'Look up one examination or investigation finding from the case file. Returns the value exactly as recorded, or that it is unavailable / not in the case.',
    parameters: {
      type: 'OBJECT',
      properties: {
        finding: { type: 'STRING', description: 'The finding the trainee asked for, e.g. "intraocular pressure", "gonioscopy", "visual acuity".' },
        eye: { type: 'STRING', enum: ['right', 'left', 'both'], description: 'Which eye, only if the trainee said one.' },
      },
      required: ['finding'],
    },
  },
  {
    name: 'get_history',
    description: 'Look up one history item from the case file.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: {
          type: 'STRING',
          description: 'One of: presenting_complaint, past_ocular_history, past_medical_history, medications, allergies, family_history.',
        },
      },
      required: ['topic'],
    },
  },
]

/** Full LiveConnectConfig. Locked into the ephemeral token server-side. */
export function buildLiveConfig(c: CaseFile = CASE) {
  return {
    responseModalities: ['AUDIO'],
    systemInstruction: buildSystemInstruction(c),
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    // Push-to-talk: the client sends activityStart/activityEnd.
    realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  }
}

// Control messages the client sends at phase changes (kept here so the wording lives in one place).
export const CONTROL = {
  start: `${CONTROL_PREFIX} The trainee has joined. Read the opening prompt now.`,
  answer: `${CONTROL_PREFIX} The findings phase is over. Say only: "Go ahead with your diagnosis and immediate management." Then, after the trainee answers, say only "Thank you." and nothing else.`,
  followUp: (q: string) => `${CONTROL_PREFIX} Ask exactly this one question, word for word, and nothing else: "${q}"`,
  close: `${CONTROL_PREFIX} Say only: "Thank you. That is the end of the viva." Then stop.`,
}

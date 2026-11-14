import type { LanguageOption } from '../types/calendar';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'auto',
    label: 'Auto-Detect',
    nativeLabel: 'Auto (All Indian Languages)',
    hint: 'Speak freely in Hindi, Bhojpuri, Tamil, Marathi, Telugu, or English — including code-switching.',
    samples: [
      {
        phrase: 'कल सुबह 11 बजे क्लाइंट कॉल बुक कर दो',
        translation: 'Book a client call tomorrow at 11 AM (Hindi)',
      },
      {
        phrase: 'बिहान सांझ के 5 बजे मीटिंग रख दीं',
        translation: 'Schedule a meeting tomorrow evening at 5 PM (Bhojpuri)',
      },
      {
        phrase: 'நாளை காலை 10 மணிக்கு என் அட்டவணை என்ன?',
        translation: 'What is my schedule tomorrow at 10 AM? (Tamil)',
      },
    ],
  },
  {
    code: 'hi',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    hint: 'Natural conversational Hindi & Hinglish scheduling.',
    samples: [
      {
        phrase: 'आज दोपहर 3 बजे के बाद मैं कब फ्री हूँ?',
        translation: 'When am I free today after 3 PM?',
      },
      {
        phrase: 'परसों सुबह 10:30 बजे डॉ. शर्मा के साथ अपॉइंटमेंट बुक करें',
        translation: 'Book an appointment with Dr. Sharma day after tomorrow at 10:30 AM',
      },
      {
        phrase: 'मेरी शाम वाली मीटिंग कल तक के लिए रीशेड्यूल कर दो',
        translation: 'Reschedule my evening meeting to tomorrow',
      },
    ],
  },
  {
    code: 'bho',
    label: 'Bhojpuri',
    nativeLabel: 'भोजपुरी',
    hint: 'Understands Bhojpuri idioms like बिहान (tomorrow), परसों, सांझ (evening), भोर (morning).',
    samples: [
      {
        phrase: 'बिहान भोर में 9 बजे एगो मीटिंग बुक कर द',
        translation: 'Book a meeting tomorrow morning at 9 AM',
      },
      {
        phrase: 'हमरा आज सांझ के केतना काम बा, तनी बता द',
        translation: 'Tell me what events I have this evening',
      },
      {
        phrase: 'ई मीटिंगवा कैंसिल कर द भइया',
        translation: 'Cancel this meeting',
      },
    ],
  },
  {
    code: 'ta',
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    hint: 'Spoken Tamil & Tanglish time/date expressions.',
    samples: [
      {
        phrase: 'நாளை மதியம் 2 மணிக்கு ஒரு மீட்டிங் புக் பண்ணுங்க',
        translation: 'Book a meeting tomorrow at 2 PM',
      },
      {
        phrase: 'இன்னைக்கு சாயங்காலம் எனக்கு ஏதாவது மீட்டிங் இருக்கா?',
        translation: 'Do I have any meetings this evening?',
      },
      {
        phrase: 'காலை 10 மணி மீட்டிங்கை 11 மணிக்கு மாத்துங்க',
        translation: 'Move the 10 AM meeting to 11 AM',
      },
    ],
  },
  {
    code: 'mr',
    label: 'Marathi',
    nativeLabel: 'मराठी',
    hint: 'Conversational Marathi & mixed English scheduling.',
    samples: [
      {
        phrase: 'उद्या सकाळी 10 वाजता प्रोजेक्ट रिव्ह्यू बुक करा',
        translation: 'Book a project review tomorrow at 10 AM',
      },
      {
        phrase: 'आज दुपारी माझा कॅलेंडर मोकळा आहे का?',
        translation: 'Is my calendar free this afternoon?',
      },
      {
        phrase: 'संध्याकाळची मीटिंग रद्द करा',
        translation: 'Cancel the evening meeting',
      },
    ],
  },
  {
    code: 'te',
    label: 'Telugu',
    nativeLabel: 'తెలుగు',
    hint: 'Spoken Telugu & Tenglish calendar booking.',
    samples: [
      {
        phrase: 'రేపు ఉదయం 11 గంటలకు ఒక మీటింగ్ బుక్ చేయండి',
        translation: 'Book a meeting tomorrow at 11 AM',
      },
      {
        phrase: 'ఈ రోజు సాయంత్రం నేను ఖాళీగా ఉన్నానా?',
        translation: 'Am I free this evening?',
      },
      {
        phrase: 'మధ్యాహ్నం మీటింగ్‌ను రేపటికి మార్చండి',
        translation: 'Move the afternoon meeting to tomorrow',
      },
    ],
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    hint: 'Clear Indian & international English.',
    samples: [
      {
        phrase: 'Check my availability for tomorrow afternoon',
        translation: 'Checks free/busy slots for tomorrow afternoon',
      },
      {
        phrase: 'Book a 45-minute product demo tomorrow at 4 PM with Google Meet',
        translation: 'Creates a Google Calendar event with Meet link',
      },
      {
        phrase: 'Reschedule my standup to 10:30 AM',
        translation: 'Finds the standup and opens confirmation to move it',
      },
    ],
  },
];

export const VOICE_OPTIONS = [
  { id: 'Zephyr' as const, label: 'Zephyr', note: 'Warm & balanced' },
  { id: 'Kore' as const, label: 'Kore', note: 'Clear & articulate' },
  { id: 'Puck' as const, label: 'Puck', note: 'Crisp & brisk' },
  { id: 'Charon' as const, label: 'Charon', note: 'Calm & composed' },
  { id: 'Fenrir' as const, label: 'Fenrir', note: 'Deep & steady' },
];

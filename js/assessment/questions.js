// Technical Questions Bank - Preloaded Initial Questions (Replaceable via Admin Dashboard)
const QUESTIONS_BANK = [
  {
    id: 1,
    type: "MCQ",
    category: "Data Structures",
    question: "Which data structure follows the Last-In-First-Out (LIFO) principle?",
    options: {
      A: "Queue",
      B: "Stack",
      C: "Linked List",
      D: "Binary Tree"
    },
    correctAnswer: "B",
    explanation: "A Stack operates on the Last-In-First-Out (LIFO) principle, where elements are inserted and popped from the top."
  },
  {
    id: 2,
    type: "MCQ",
    category: "Digital Electronics",
    question: "How many select lines are needed for an 8-to-1 Multiplexer (MUX)?",
    options: {
      A: "2",
      B: "3",
      C: "4",
      D: "8"
    },
    correctAnswer: "B",
    explanation: "An 8-to-1 Multiplexer has 2^n = 8 inputs, which requires n = log2(8) = 3 select lines."
  },
  {
    id: 3,
    type: "MCQ",
    category: "Computer Networks",
    question: "What standard port number is used for HTTPS web traffic?",
    options: {
      A: "80",
      B: "21",
      C: "443",
      D: "8080"
    },
    correctAnswer: "C",
    explanation: "Port 443 is universally designated for secure encrypted web traffic over HTTPS (SSL/TLS)."
  },
  {
    id: 4,
    type: "FIB",
    category: "Computer Networks",
    question: "The protocol used to map an IP address to a physical MAC address is _______.",
    options: null,
    correctAnswer: "ARP",
    explanation: "Address Resolution Protocol (ARP) translates a known IPv4 network layer address into a physical MAC hardware link address."
  },
  {
    id: 5,
    type: "FIB",
    category: "Electronics",
    question: "In a PN junction diode under reverse breakdown the current increases _______.",
    options: null,
    correctAnswer: "sharply",
    explanation: "Under reverse breakdown (Zener or Avalanche effect), the electric field causes a rapid generation of carriers, leading to a sharp current rise."
  },
  {
    id: 6,
    type: "FIB",
    category: "Operating Systems",
    question: "A binary semaphore initialized to 1 is commonly known as a _______.",
    options: null,
    correctAnswer: "Mutex",
    explanation: "A binary semaphore having only 0 or 1 values behaves as a Mutual Exclusion lock (Mutex)."
  }
];

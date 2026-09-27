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
    type: "MCQ",
    category: "Algorithms",
    question: "What is the worst-case time complexity of QuickSort?",
    options: {
      A: "O(n log n)",
      B: "O(n)",
      C: "O(n^2)",
      D: "O(log n)"
    },
    correctAnswer: "C",
    explanation: "QuickSort exhibits O(n^2) worst-case time complexity when the chosen pivot consistently splits the array into unbalanced partitions."
  },
  {
    id: 5,
    type: "MCQ",
    category: "Microprocessors",
    question: "How many address lines are present in the 8085 microprocessor?",
    options: {
      A: "8",
      B: "16",
      C: "20",
      D: "32"
    },
    correctAnswer: "B",
    explanation: "The 8085 microprocessor has 16 address lines (A0-A15), allowing it to address up to 2^16 = 64 KB of memory."
  },
  {
    id: 6,
    type: "MCQ",
    category: "Signals & Systems",
    question: "The Fourier Transform of a unit impulse function δ(t) is _______.",
    options: {
      A: "0",
      B: "1",
      C: "2π",
      D: "1/s"
    },
    correctAnswer: "B",
    explanation: "The Fourier Transform of the Dirac delta unit impulse function is constant equal to 1 across all frequencies."
  },
  {
    id: 7,
    type: "MCQ",
    category: "VLSI Design",
    question: "In CMOS inverter design, which transistor acts as the pull-up network?",
    options: {
      A: "NMOS",
      B: "PMOS",
      C: "BJT",
      D: "JFET"
    },
    correctAnswer: "B",
    explanation: "In static CMOS circuits, PMOS transistors conduct when the gate is low (0V) and are used in the pull-up network connected to VDD."
  },
  {
    id: 8,
    type: "MCQ",
    category: "Programming & C",
    question: "What is the size of a pointer variable in a standard 64-bit architecture?",
    options: {
      A: "2 Bytes",
      B: "4 Bytes",
      C: "8 Bytes",
      D: "16 Bytes"
    },
    correctAnswer: "C",
    explanation: "On 64-bit hardware architectures, all memory address pointers occupy 64 bits (8 Bytes)."
  },
  {
    id: 9,
    type: "MCQ",
    category: "Control Systems",
    question: "A system is defined as BIBO stable if every bounded input produces a _______.",
    options: {
      A: "Zero output",
      B: "Bounded output",
      C: "Unbounded output",
      D: "Sinusoidal output"
    },
    correctAnswer: "B",
    explanation: "Bounded-Input Bounded-Output (BIBO) stability requires that for any bounded input, the corresponding output also remains bounded."
  },
  {
    id: 10,
    type: "MCQ",
    category: "Digital Electronics",
    question: "Which logic gate is known as the Universal Gate?",
    options: {
      A: "AND",
      B: "OR",
      C: "NAND",
      D: "XOR"
    },
    correctAnswer: "C",
    explanation: "NAND and NOR gates are universal gates because any Boolean logic function can be implemented exclusively using them."
  },
  {
    id: 11,
    type: "FIB",
    category: "Computer Networks",
    question: "The protocol used to map an IP address to a physical MAC address is _______.",
    options: null,
    correctAnswer: "ARP",
    explanation: "Address Resolution Protocol (ARP) translates a known IPv4 network layer address into a physical MAC hardware link address."
  },
  {
    id: 12,
    type: "FIB",
    category: "Electronics",
    question: "In a PN junction diode under reverse breakdown the current increases _______.",
    options: null,
    correctAnswer: "sharply",
    explanation: "Under reverse breakdown (Zener or Avalanche effect), the electric field causes a rapid generation of carriers, leading to a sharp current rise."
  },
  {
    id: 13,
    type: "FIB",
    category: "Operating Systems",
    question: "A binary semaphore initialized to 1 is commonly known as a _______.",
    options: null,
    correctAnswer: "Mutex",
    explanation: "A binary semaphore having only 0 or 1 values behaves as a Mutual Exclusion lock (Mutex)."
  },
  {
    id: 14,
    type: "FIB",
    category: "Data Structures",
    question: "A tree in which each node has at most two children is called a _______ tree.",
    options: null,
    correctAnswer: "Binary",
    explanation: "A binary tree is a hierarchical data structure in which every node has at most two children (left and right)."
  },
  {
    id: 15,
    type: "FIB",
    category: "Digital Signal Processing",
    question: "The minimum sampling rate required to avoid aliasing is known as the _______ rate.",
    options: null,
    correctAnswer: "Nyquist",
    explanation: "The Nyquist rate is equal to twice the highest frequency component present in the signal (fs >= 2*fm)."
  },
  {
    id: 16,
    type: "FIB",
    category: "Electronics",
    question: "The ideal voltage gain of an ideal Operational Amplifier (Op-Amp) is _______.",
    options: null,
    correctAnswer: "Infinite",
    explanation: "An ideal operational amplifier possesses infinite open-loop voltage gain, infinite input impedance, and zero output impedance."
  },
  {
    id: 17,
    type: "FIB",
    category: "Algorithms",
    question: "The shortest path algorithm invented by Edsger W. Dijkstra is _______ algorithm.",
    options: null,
    correctAnswer: "Dijkstra",
    explanation: "Dijkstra's algorithm solves the single-source shortest path problem for graphs with non-negative edge weights."
  },
  {
    id: 18,
    type: "FIB",
    category: "VLSI",
    question: "In CMOS technology, when input is logic HIGH (1), the NMOS transistor turns _______.",
    options: null,
    correctAnswer: "ON",
    explanation: "An enhancement-mode NMOS transistor turns ON (conducts) when gate voltage VGS exceeds the threshold voltage VT."
  },
  {
    id: 19,
    type: "FIB",
    category: "Computer Networks",
    question: "The layer of the OSI model responsible for end-to-end reliability and error recovery is the _______ layer.",
    options: null,
    correctAnswer: "Transport",
    explanation: "The Transport layer (Layer 4) provides transparent transfer of data between end users, handling flow control, segmentation, and error control."
  },
  {
    id: 20,
    type: "FIB",
    category: "Programming & Python",
    question: "In Python, the built-in function used to obtain the total number of items in a list or string is _______.",
    options: null,
    correctAnswer: "len",
    explanation: "The len() function in Python returns the length (the number of items) of an object."
  }
];

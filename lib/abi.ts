const eventView = {
  name: "",
  type: "tuple",
  components: [
    { name: "id", type: "uint256" },
    { name: "organizer", type: "address" },
    { name: "signer", type: "address" },
    { name: "name", type: "string" },
    { name: "description", type: "string" },
    { name: "location", type: "string" },
    { name: "createdAt", type: "uint64" },
    { name: "startsAt", type: "uint64" },
    { name: "endsAt", type: "uint64" },
    { name: "maxClaims", type: "uint32" },
    { name: "evmClaims", type: "uint32" },
    { name: "solanaClaims", type: "uint32" },
    { name: "closed", type: "bool" },
  ],
} as const;

const badge = {
  name: "",
  type: "tuple[]",
  components: [
    { name: "eventId", type: "uint256" },
    { name: "claimedAt", type: "uint64" },
    { name: "solana", type: "bool" },
  ],
} as const;

export const tesseraAbi = [
  {
    type: "function",
    name: "eventCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createEvent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "location", type: "string" },
      { name: "startsAt", type: "uint64" },
      { name: "endsAt", type: "uint64" },
      { name: "maxClaims", type: "uint32" },
      { name: "signer", type: "address" },
    ],
    outputs: [{ name: "eventId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimAsSolana",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "signature", type: "bytes" },
      { name: "solanaPubkey", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "rotateSigner",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "newSigner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closeEvent",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getEvent",
    stateMutability: "view",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [eventView],
  },
  {
    type: "function",
    name: "getEvents",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ ...eventView, type: "tuple[]" }],
  },
  {
    type: "function",
    name: "claimedAt",
    stateMutability: "view",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "attendee", type: "address" },
    ],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "badgeCount",
    stateMutability: "view",
    inputs: [{ name: "attendee", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "badgesOf",
    stateMutability: "view",
    inputs: [
      { name: "attendee", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [badge],
  },
] as const;

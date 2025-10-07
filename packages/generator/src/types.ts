export type Relationship =
  | { type: 'similarity'; score: number }
  | { type: 'hierarchy'; role: 'parent' | 'child' }

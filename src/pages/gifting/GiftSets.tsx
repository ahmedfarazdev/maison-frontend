// ============================================================
// Gift Sets — Curated gift set management
// Re-exports the main Gifting page which already handles sets
// ============================================================

import Gifting from './Gifting';

// The main Gifting page already manages gift sets as its primary view.
// This route simply renders the same component for /gifting/sets navigation.
export default function GiftSets() {
  return <Gifting />;
}

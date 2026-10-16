//! Parked ideas: thoughts that pop up mid-task, written down in a second so
//! they stop nagging, and looked at later.

use serde::Serialize;

/// Longest idea we keep, in characters.
pub const MAX_IDEA_CHARS: usize = 500;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ParkedIdea {
    pub id: u64,
    pub text: String,
    /// When it was parked, in milliseconds since 1970 (the caller's clock).
    pub created_ms: i64,
    /// The user has looked at it and marked it as seen.
    pub seen: bool,
}

#[derive(Debug, Default)]
pub struct Ideas {
    items: Vec<ParkedIdea>,
    next_id: u64,
}

impl Ideas {
    pub fn new() -> Self {
        Self::default()
    }

    /// Parks an idea. Blank text is ignored; returns whether it was kept.
    pub fn park(&mut self, text: &str, created_ms: i64) -> bool {
        let text: String = text.trim().chars().take(MAX_IDEA_CHARS).collect();
        if text.is_empty() {
            return false;
        }
        self.next_id += 1;
        self.items.push(ParkedIdea {
            id: self.next_id,
            text,
            created_ms,
            seen: false,
        });
        true
    }

    pub fn mark_seen(&mut self, id: u64) {
        // `iter_mut` lends us each idea so we can change it in place.
        if let Some(idea) = self.items.iter_mut().find(|idea| idea.id == id) {
            idea.seen = true;
        }
    }

    pub fn delete(&mut self, id: u64) {
        self.items.retain(|idea| idea.id != id);
    }

    /// Newest first, as the panel shows them.
    pub fn newest_first(&self) -> Vec<ParkedIdea> {
        self.items.iter().rev().cloned().collect()
    }

    pub fn unseen_count(&self) -> usize {
        self.items.iter().filter(|idea| !idea.seen).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parks_trimmed_text_and_ignores_blank_ideas() {
        let mut ideas = Ideas::new();
        assert!(ideas.park("  call the dentist \n", 1_000));
        assert!(!ideas.park("   ", 2_000));
        let list = ideas.newest_first();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].text, "call the dentist");
        assert_eq!(list[0].created_ms, 1_000);
    }

    #[test]
    fn newest_first_with_unique_ids() {
        let mut ideas = Ideas::new();
        ideas.park("first", 1);
        ideas.park("second", 2);
        let list = ideas.newest_first();
        assert_eq!(list[0].text, "second");
        assert_eq!(list[1].text, "first");
        assert_ne!(list[0].id, list[1].id);
    }

    #[test]
    fn seen_ideas_stop_counting_and_deleted_ideas_disappear() {
        let mut ideas = Ideas::new();
        ideas.park("a", 1);
        ideas.park("b", 2);
        assert_eq!(ideas.unseen_count(), 2);
        let first = ideas.newest_first()[1].id;
        ideas.mark_seen(first);
        assert_eq!(ideas.unseen_count(), 1);
        ideas.delete(first);
        assert_eq!(ideas.newest_first().len(), 1);
        ideas.mark_seen(999); // unknown id: nothing happens
        ideas.delete(999);
        assert_eq!(ideas.unseen_count(), 1);
    }

    #[test]
    fn very_long_ideas_are_cut() {
        let mut ideas = Ideas::new();
        ideas.park(&"x".repeat(MAX_IDEA_CHARS + 50), 1);
        assert_eq!(ideas.newest_first()[0].text.chars().count(), MAX_IDEA_CHARS);
    }
}

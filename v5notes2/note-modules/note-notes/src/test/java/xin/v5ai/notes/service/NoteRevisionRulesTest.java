package xin.v5ai.notes.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NoteRevisionRulesTest {

    @Test
    void normalContentChangeWritesHistory() {
        assertTrue(NoteRevisionRules.appendOnSave(true, null));
        assertTrue(NoteRevisionRules.appendOnSave(true, false));
    }

    @Test
    void previewTaskSaveSkipsHistoryQuota() {
        assertFalse(NoteRevisionRules.appendOnSave(true, true));
    }

    @Test
    void unchangedContentNeverWritesHistory() {
        assertFalse(NoteRevisionRules.appendOnSave(false, null));
        assertFalse(NoteRevisionRules.appendOnSave(false, true));
    }
}

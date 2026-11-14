package xin.v5ai.vault.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class VaultPathRulesTest {

    @Test
    void normalizesDisplayAndIdentity() {
        var path = VaultPathRules.normalize("工作\\周报.MD");
        assertEquals("工作/周报.MD", path.displayPath());
        assertEquals("工作/周报.md", path.identityKey());
    }

    @Test
    void rejectsReservedAndTraversal() {
        assertThrows(IllegalArgumentException.class, () -> VaultPathRules.normalize("CON.md"));
        assertThrows(IllegalArgumentException.class, () -> VaultPathRules.normalize("../x.md"));
        assertThrows(IllegalArgumentException.class, () -> VaultPathRules.normalize("/abs.md"));
    }

    @Test
    void caseFoldIdentityCollides() {
        assertEquals(
            VaultPathRules.normalize("Notes/A.md").identityKey(),
            VaultPathRules.normalize("notes/a.MD").identityKey()
        );
    }
}

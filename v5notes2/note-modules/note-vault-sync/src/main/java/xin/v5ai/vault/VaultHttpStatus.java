package xin.v5ai.vault;

/**
 * HTTP codes this module needs that the shared {@code common-core HttpStatus} does not declare.
 *
 * <p>Kept local on purpose: adding members to the shared constant class would touch every module
 * in the project for the benefit of one feature.</p>
 */
public final class VaultHttpStatus {

    /** Partial content, for {@code Range} reads of attachment bodies. */
    public static final int PARTIAL_CONTENT = 206;

    /** Request entity too large, used by the 25MB single-file ceiling. */
    public static final int PAYLOAD_TOO_LARGE = 413;

    /** Attachment storage is not configured; the client should retry later, not fail permanently. */
    public static final int SERVICE_UNAVAILABLE = 503;

    private VaultHttpStatus() {
    }
}

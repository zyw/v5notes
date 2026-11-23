package xin.v5ai.basics.file.core.enums;

/**
 * What a file config is used for (design D2).
 *
 * <p>Before this existed, every uploader shared the single {@code master} config. Attachments
 * now get their own row so switching the attachment backend to S3 never moves the image library,
 * and vice versa.</p>
 */
public enum FileConfigPurpose {

    /** Image library, avatars, editor inserts. */
    GENERIC,

    /** Vault sync attachments. */
    VAULT_ASSET
}

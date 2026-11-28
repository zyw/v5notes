package xin.v5ai.basics.file.core.client.s3;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.awscore.exception.AwsErrorDetails;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.oss.client.OssClient;
import xin.v5ai.common.oss.exception.S3StorageException;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class S3FileClientTest {

    @Mock
    private OssClient ossClient;

    private S3FileClient newClient(String bucket) {
        S3FileClientConfig config = new S3FileClientConfig();
        config.setEndpoint("192.168.10.13:9000");
        config.setBucket(bucket);
        config.setAccessKey("admin");
        config.setAccessSecret("secret");
        return new S3FileClient(1L, config, ossClient);
    }

    @Test
    void uploadTranslatesNoSuchBucketExceptionToServiceExceptionWithBucketName() {
        S3FileClient client = newClient("vault-dev");
        S3StorageException storageEx = S3StorageException.form(
            NoSuchBucketException.builder().message("The specified bucket does not exist").build()
        );
        byte[] content = "hello".getBytes(StandardCharsets.UTF_8);
        when(ossClient.upload("a/b", content)).thenThrow(storageEx);

        ServiceException ex = assertThrows(ServiceException.class, () -> client.upload(content, "a/b", "text/plain"));
        assertTrue(ex.getMessage().contains("存储桶 [vault-dev] 不存在"));
    }

    @Test
    void deleteTranslatesNoSuchBucketExceptionToServiceExceptionWithBucketName() {
        S3FileClient client = newClient("vault-dev");
        S3StorageException storageEx = S3StorageException.form(
            NoSuchBucketException.builder().message("The specified bucket does not exist").build()
        );
        doThrow(storageEx).when(ossClient).delete("a/b");

        ServiceException ex = assertThrows(ServiceException.class, () -> client.delete("a/b"));
        assertTrue(ex.getMessage().contains("存储桶 [vault-dev] 不存在"));
    }

    @Test
    void getContentTranslatesNoSuchBucketExceptionToServiceExceptionWithBucketName() {
        S3FileClient client = newClient("vault-dev");
        S3StorageException storageEx = S3StorageException.form(
            NoSuchBucketException.builder().message("The specified bucket does not exist").build()
        );
        when(ossClient.download(eq("a/b"), any(OutputStream.class))).thenThrow(storageEx);

        ServiceException ex = assertThrows(ServiceException.class, () -> client.getContent("a/b"));
        assertTrue(ex.getMessage().contains("存储桶 [vault-dev] 不存在"));
    }

    @Test
    void uploadTranslatesS3ExceptionWithNoSuchBucketErrorCode() {
        S3FileClient client = newClient("vault-dev");
        S3Exception s3Ex = (S3Exception) S3Exception.builder()
            .awsErrorDetails(AwsErrorDetails.builder().errorCode("NoSuchBucket").errorMessage("missing").build())
            .statusCode(404)
            .build();
        byte[] content = "hello".getBytes(StandardCharsets.UTF_8);
        when(ossClient.upload("a/b", content)).thenThrow(S3StorageException.form(s3Ex));

        ServiceException ex = assertThrows(ServiceException.class, () -> client.upload(content, "a/b", "text/plain"));
        assertTrue(ex.getMessage().contains("存储桶 [vault-dev] 不存在"));
    }

    @Test
    void uploadRethrowsNonBucketS3StorageException() {
        S3FileClient client = newClient("vault-dev");
        S3StorageException storageEx = S3StorageException.form("other error");
        byte[] content = "hello".getBytes(StandardCharsets.UTF_8);
        when(ossClient.upload("a/b", content)).thenThrow(storageEx);

        S3StorageException ex = assertThrows(S3StorageException.class, () -> client.upload(content, "a/b", "text/plain"));
        assertSame(storageEx, ex);
    }
}

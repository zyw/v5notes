package xin.v5ai.basics.file.core.client.ftp;

import cn.hutool.extra.ftp.FtpMode;
import org.apache.commons.net.ftp.FTPClient;
import org.apache.commons.pool2.BasePooledObjectFactory;
import org.apache.commons.pool2.PooledObject;
import org.apache.commons.pool2.impl.DefaultPooledObject;
import org.apache.commons.pool2.impl.GenericObjectPool;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pooled connection semantics (design T1 / A1–A6).
 *
 * <p>No FTP server is involved: what this test pins down is that each concurrent operation owns
 * a distinct connection for its whole duration — exactly what the previous single-{@code FTPClient}
 * design could not guarantee, and the reason files could land in another operation's directory.</p>
 */
class FTPFileClientConcurrencyTest {

    /** Tracks creation, destruction and concurrency of borrowed objects. */
    private static final class TrackingFactory extends BasePooledObjectFactory<FTPClient> {

        final AtomicInteger created = new AtomicInteger();
        final Set<FTPClient> live = ConcurrentHashMap.newKeySet();
        final AtomicInteger users = new AtomicInteger();
        final AtomicInteger maxUsers = new AtomicInteger();

        @Override
        public FTPClient create() {
            created.incrementAndGet();
            FTPClient client = new FTPClient();
            live.add(client);
            return client;
        }

        @Override
        public PooledObject<FTPClient> wrap(FTPClient client) {
            return new DefaultPooledObject<>(client);
        }

        @Override
        public void destroyObject(PooledObject<FTPClient> pooled) {
            live.remove(pooled.getObject());
        }

        void enter() {
            maxUsers.accumulateAndGet(users.incrementAndGet(), Math::max);
        }

        void exit() {
            users.decrementAndGet();
        }
    }

    private static GenericObjectPool<FTPClient> pool(TrackingFactory factory, int maxTotal, long maxWaitMs) {
        GenericObjectPoolConfig<FTPClient> cfg = new GenericObjectPoolConfig<>();
        cfg.setMaxTotal(maxTotal);
        cfg.setMaxWait(Duration.ofMillis(maxWaitMs));
        return new GenericObjectPool<>(factory, cfg);
    }

    @Test
    void concurrentOperationsNeverShareAConnection() throws Exception {
        TrackingFactory factory = new TrackingFactory();
        GenericObjectPool<FTPClient> pool = pool(factory, 8, 5_000);
        int workers = 8;
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<FTPClient>> futures = new ArrayList<>();

        for (int i = 0; i < workers; i++) {
            futures.add(executor.submit(() -> {
                start.await();
                FTPClient client = pool.borrowObject();
                try {
                    factory.enter();
                    Thread.sleep(20);
                    return client;
                } finally {
                    factory.exit();
                    pool.returnObject(client);
                }
            }));
        }
        start.countDown();

        Set<FTPClient> seen = ConcurrentHashMap.newKeySet();
        for (Future<FTPClient> future : futures) {
            seen.add(future.get(10, TimeUnit.SECONDS));
        }
        executor.shutdownNow();
        pool.close();

        assertEquals(workers, seen.size(), "each concurrent operation must own a distinct connection");
        assertTrue(factory.maxUsers.get() > 1, "operations really overlapped in time");
    }

    @Test
    void exhaustedPoolWaitsThenFails() throws Exception {
        TrackingFactory factory = new TrackingFactory();
        GenericObjectPool<FTPClient> pool = pool(factory, 1, 150);

        FTPClient held = pool.borrowObject();
        long begin = System.currentTimeMillis();
        try {
            assertThrows(NoSuchElementException.class, pool::borrowObject,
                "a second borrow must not succeed while maxTotal=1 is exhausted");
            assertTrue(System.currentTimeMillis() - begin >= 100,
                "the borrow must wait for maxWait before giving up");
        } finally {
            pool.returnObject(held);
            pool.close();
        }
    }

    @Test
    void invalidatedConnectionIsNeverReused() throws Exception {
        TrackingFactory factory = new TrackingFactory();
        GenericObjectPool<FTPClient> pool = pool(factory, 1, 1_000);

        FTPClient first = pool.borrowObject();
        pool.invalidateObject(first);
        FTPClient second = pool.borrowObject();

        assertNotSame(first, second);
        assertEquals(2, factory.created.get());
        pool.returnObject(second);
        pool.close();
    }

    @Test
    void closingThePoolReleasesEveryIdleConnection() throws Exception {
        TrackingFactory factory = new TrackingFactory();
        GenericObjectPool<FTPClient> pool = pool(factory, 4, 1_000);

        // Hold several at once: borrow-then-return in a loop simply reuses the same connection.
        List<FTPClient> held = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            held.add(pool.borrowObject());
        }
        assertEquals(3, factory.live.size());
        // Return them so they sit idle in the pool.
        for (FTPClient client : held) {
            pool.returnObject(client);
        }

        pool.close();

        assertTrue(factory.live.isEmpty(), "closing the pool must destroy every idle connection");

        // A connection still on loan at close time is destroyed when it is finally returned,
        // which is what keeps a force-closed pool from leaking sockets.
        TrackingFactory second = new TrackingFactory();
        GenericObjectPool<FTPClient> pool2 = pool(second, 2, 500);
        FTPClient onLoan = pool2.borrowObject();
        pool2.close();
        assertEquals(1, second.live.size(), "on-loan connection is not destroyed by close()");
        pool2.returnObject(onLoan);
        assertTrue(second.live.isEmpty(), "returning it after close destroys it");
    }

    @Test
    void ftpsForcesPassiveWithoutMutatingSharedConfig() {
        FTPFileClientConfig config = baseConfig();
        config.setMode("Active");
        config.setSslEnable(true);

        assertEquals(FtpMode.Passive, FTPConnectionFactory.resolveMode(config));
        // The mode adjustment is per-connection; writing it back would leak across threads.
        assertEquals("Active", config.getMode());
    }

    @Test
    void plainFtpKeepsActive() {
        FTPFileClientConfig config = baseConfig();
        config.setMode("Active");
        config.setSslEnable(false);
        assertEquals(FtpMode.Active, FTPConnectionFactory.resolveMode(config));
    }

    @Test
    void invalidCharsetFallsBackToUtf8() {
        FTPFileClientConfig config = baseConfig();
        config.setCharset("NOT-A-CHARSET");
        assertEquals("UTF-8", FTPConnectionFactory.resolveCharset(config));
    }

    @Test
    void declaredCharsetIsKept() {
        FTPFileClientConfig config = baseConfig();
        config.setCharset("GBK");
        assertEquals("GBK", FTPConnectionFactory.resolveCharset(config));
    }

    private static FTPFileClientConfig baseConfig() {
        FTPFileClientConfig config = new FTPFileClientConfig();
        config.setBasePath("/base/");
        config.setDomain("https://example.com");
        config.setHost("127.0.0.1");
        config.setPort(21);
        config.setUsername("u");
        config.setPassword("p");
        config.setMode("Passive");
        config.setSslEnable(false);
        config.setCharset("UTF-8");
        return config;
    }
}

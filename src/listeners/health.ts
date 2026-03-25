import { Listener } from '@sapphire/framework';
import { reportMetrics, resetCounters, getMetricSnapshot } from '../lib/metrics';

export class HealthListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: 'ready',
      once: true
    });
  }

  public override run() {
    const client = this.container.client;
    const shardId = client.shard?.ids[0] ?? null;

    // Report metrics every 30 seconds
    setInterval(async () => {
      await reportMetrics(shardId);

      // Log warning if event loop is lagging
      const snapshot = getMetricSnapshot(shardId);
      if (snapshot.avgEventLatencyMs > 100) {
        this.container.logger.warn(
          `[SYNΞ:S${shardId}] High event loop latency: ${snapshot.avgEventLatencyMs}ms`
        );
      }

      // Log warning if memory is high
      if (snapshot.memoryUsageMB > 400) {
        this.container.logger.warn(
          `[SYNΞ:S${shardId}] High memory usage: ${snapshot.memoryUsageMB}MB`
        );
      }

      resetCounters();
    }, 30_000);

    this.container.logger.info(
      `[SYNΞ:S${shardId}] Health monitoring active (30s interval)`
    );
  }
}

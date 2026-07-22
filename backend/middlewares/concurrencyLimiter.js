// ============================================================
// CompressKro Backend — Concurrency Limiter Middleware
// Serializes heavy memory-intensive processing jobs (like Sharp
// compression or PDF optimization) to prevent container OOMs.
// Includes a request-level timeout to abort slow/hung tasks.
// ============================================================

class ConcurrencyQueue {
  constructor(maxConcurrent = 1, timeoutMs = 45000) {
    this.maxConcurrent = maxConcurrent;
    this.timeoutMs = timeoutMs;
    this.activeCount = 0;
    this.queue = [];
  }

  run(fn) {
    return new Promise((resolve, reject) => {
      const task = { fn, resolve, reject, timedOut: false, started: false };
      
      const timeoutId = setTimeout(() => {
        task.timedOut = true;
        
        // Remove from queue if it hasn't run yet
        const idx = this.queue.indexOf(task);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        
        const err = new Error('Request timeout: The server is currently overloaded or the operation exceeded the maximum execution time limit (45s).');
        err.statusCode = 503; // Service Unavailable
        
        // If already started, decrement activeCount to allow queue to move forward
        if (task.started) {
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.next();
        }
        
        reject(err);
      }, this.timeoutMs);

      task.timeoutId = timeoutId;
      this.queue.push(task);
      this.next();
    });
  }

  next() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (task.timedOut) {
      this.next();
      return;
    }

    this.activeCount++;
    task.started = true;
    
    task.fn()
      .then((result) => {
        if (!task.timedOut) {
          clearTimeout(task.timeoutId);
          this.activeCount = Math.max(0, this.activeCount - 1);
          task.resolve(result);
          this.next();
        }
      })
      .catch((err) => {
        if (!task.timedOut) {
          clearTimeout(task.timeoutId);
          this.activeCount = Math.max(0, this.activeCount - 1);
          task.reject(err);
          this.next();
        }
      });
  }
}

// 512MB RAM container can safely handle 1 heavy compression task at a time
const queue = new ConcurrencyQueue(1, 45000);

function limitConcurrency(req, res, next) {
  const url = req.originalUrl || req.url;
  console.log(`[Queue] Request for ${url} entered queue. Active jobs: ${queue.activeCount}, Queue length: ${queue.queue.length}`);
  
  queue.run(() => {
    return new Promise((resolve) => {
      // Release slot as soon as the response is fully sent or connection is closed
      res.once('finish', () => {
        console.log(`[Queue] Job completed for ${url}. Releasing slot.`);
        resolve();
      });
      res.once('close', () => {
        console.log(`[Queue] Connection closed for ${url}. Releasing slot.`);
        resolve();
      });
      
      // Pass control to the next handler/middleware
      next();
    });
  }).catch((err) => {
    if (!res.headersSent) {
      console.warn(`[Queue] Request for ${url} failed or timed out: ${err.message}`);
      res.status(err.statusCode || 500).json({
        error: true,
        message: err.message
      });
    }
  });
}

module.exports = limitConcurrency;

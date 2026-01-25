/**
 * ENOVA Load Test - K6
 * 
 * Stress test configuration to verify 100 concurrent connections
 * without degrading performance.
 * 
 * Install: brew install k6 / npm install -g k6
 * Run: k6 run stress-test.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

// Test credentials (use test accounts)
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@example.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'testpass123';

// Custom metrics
const wsConnections = new Counter('ws_connections');
const wsMessages = new Counter('ws_messages');
const wsErrors = new Counter('ws_errors');
const messageLatency = new Trend('message_latency');
const feedLoadTime = new Trend('feed_load_time');

// ═══════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    // Scenario 1: Smoke test (basic functionality)
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },
    
    // Scenario 2: Load test (normal load)
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp up to 50 users
        { duration: '1m', target: 50 },   // Stay at 50 users
        { duration: '30s', target: 0 },   // Ramp down
      ],
      tags: { test_type: 'load' },
      startTime: '1m30s', // Start after smoke test
    },
    
    // Scenario 3: Stress test (100 concurrent connections)
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '2m', target: 100 },  // Stay at 100 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'stress' },
      startTime: '4m', // Start after load test
    },
    
    // Scenario 4: Spike test (sudden traffic spike)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 150 }, // Spike to 150 users
        { duration: '30s', target: 150 }, // Hold
        { duration: '10s', target: 0 },   // Drop
      ],
      tags: { test_type: 'spike' },
      startTime: '8m', // Start after stress test
    },
  },
  
  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],    // Less than 1% errors
    ws_connections: ['count>0'],
    message_latency: ['p(95)<500'],    // Chat messages under 500ms
    feed_load_time: ['p(95)<3000'],    // Feed loads under 3s
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export default function () {
  group('Feed Operations', function () {
    testFeedLoad();
  });
  
  group('Chat Operations', function () {
    testChatConnection();
  });
  
  sleep(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function testFeedLoad() {
  const startTime = new Date();
  
  // Simulate loading the dashboard
  const res = http.get(`${BASE_URL}/dashboard`, {
    headers: {
      'Accept': 'text/html',
    },
  });
  
  const loadTime = new Date() - startTime;
  feedLoadTime.add(loadTime);
  
  check(res, {
    'dashboard status is 200 or redirect': (r) => r.status === 200 || r.status === 302,
    'dashboard loads under 3s': () => loadTime < 3000,
  });
}

function testChatConnection() {
  const startTime = new Date();
  
  const res = ws.connect(`${WS_URL}/socket.io/?EIO=4&transport=websocket`, {}, function (socket) {
    wsConnections.add(1);
    
    socket.on('open', function () {
      const connectionTime = new Date() - startTime;
      console.log(`WebSocket connected in ${connectionTime}ms`);
      
      // Join room
      socket.send(JSON.stringify({
        type: 'join_room',
        roomId: 'general',
        userId: `stress_test_${__VU}`,
      }));
    });
    
    socket.on('message', function (data) {
      wsMessages.add(1);
      const latency = new Date() - startTime;
      messageLatency.add(latency);
    });
    
    socket.on('error', function (e) {
      wsErrors.add(1);
      console.error('WebSocket error:', e);
    });
    
    // Send test message
    socket.setTimeout(function () {
      const messageStart = new Date();
      socket.send(JSON.stringify({
        type: 'send_message',
        roomId: 'general',
        userId: `stress_test_${__VU}`,
        username: `LoadTest User ${__VU}`,
        message: `Stress test message from VU ${__VU}`,
        timestamp: new Date().toISOString(),
      }));
    }, 1000);
    
    // Keep connection alive for a bit
    socket.setTimeout(function () {
      socket.close();
    }, 5000);
  });
  
  check(res, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════

export function handleSummary(data) {
  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const metrics = data.metrics;
  
  let summary = `
╔══════════════════════════════════════════════════════════════╗
║              ENOVA STRESS TEST RESULTS                       ║
╠══════════════════════════════════════════════════════════════╣
║ HTTP Requests                                                ║
║   Total: ${metrics.http_reqs?.values?.count || 0}
║   Failed: ${metrics.http_req_failed?.values?.rate * 100 || 0}%
║   Duration (p95): ${metrics.http_req_duration?.values?.['p(95)'] || 0}ms
╠══════════════════════════════════════════════════════════════╣
║ WebSocket                                                    ║
║   Connections: ${metrics.ws_connections?.values?.count || 0}
║   Messages: ${metrics.ws_messages?.values?.count || 0}
║   Errors: ${metrics.ws_errors?.values?.count || 0}
║   Message Latency (p95): ${metrics.message_latency?.values?.['p(95)'] || 0}ms
╠══════════════════════════════════════════════════════════════╣
║ Feed                                                         ║
║   Load Time (p95): ${metrics.feed_load_time?.values?.['p(95)'] || 0}ms
╚══════════════════════════════════════════════════════════════╝
`;
  
  return summary;
}

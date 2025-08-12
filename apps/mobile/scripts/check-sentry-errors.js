#!/usr/bin/env node

const https = require('https');

// Configuration from environment
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const DEPLOYMENT_TIME = process.env.DEPLOYMENT_TIME || new Date().toISOString();

// Calculate time windows
const deploymentDate = new Date(DEPLOYMENT_TIME);
const beforeDeployment = new Date(deploymentDate.getTime() - 30 * 60 * 1000); // 30 min before
const afterDeployment = new Date(deploymentDate.getTime() + 5 * 60 * 1000); // 5 min after

async function fetchSentryStats(timeRange) {
  const options = {
    hostname: 'sentry.io',
    path: `/api/0/organizations/${SENTRY_ORG}/stats/?field=sum(quantity)&groupBy=outcome&interval=5m&project=${SENTRY_PROJECT}&start=${timeRange.start}&end=${timeRange.end}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkErrorRates() {
  try {
    console.log('🔍 Checking Sentry error rates...');
    console.log(`Deployment time: ${DEPLOYMENT_TIME}`);
    
    // Get stats before deployment
    const beforeStats = await fetchSentryStats({
      start: beforeDeployment.toISOString(),
      end: deploymentDate.toISOString()
    });
    
    // Get stats after deployment
    const afterStats = await fetchSentryStats({
      start: deploymentDate.toISOString(),
      end: afterDeployment.toISOString()
    });
    
    // Calculate error rates
    const getErrorCount = (stats) => {
      let errors = 0;
      stats.groups?.forEach(group => {
        if (group.by.outcome === 'accepted') {
          errors += group.totals['sum(quantity)'] || 0;
        }
      });
      return errors;
    };
    
    const errorsBefore = getErrorCount(beforeStats);
    const errorsAfter = getErrorCount(afterStats);
    const errorIncrease = errorsAfter - errorsBefore;
    const percentIncrease = errorsBefore > 0 ? (errorIncrease / errorsBefore) * 100 : 0;
    
    console.log(`📊 Errors before deployment: ${errorsBefore}`);
    console.log(`📊 Errors after deployment: ${errorsAfter}`);
    console.log(`📈 Error increase: ${errorIncrease} (${percentIncrease.toFixed(1)}%)`);
    
    // Check error thresholds
    const isHighIncrease = percentIncrease > 50;
    const isHighVolume = errorsAfter > 100;
    const shouldAlert = isHighIncrease || isHighVolume;
    
    // Output metrics for the workflow to use
    console.log(`::set-output name=errors_before::${errorsBefore}`);
    console.log(`::set-output name=errors_after::${errorsAfter}`);
    console.log(`::set-output name=percent_increase::${percentIncrease.toFixed(1)}`);
    console.log(`::set-output name=should_alert::${shouldAlert}`);
    
    if (shouldAlert) {
      console.log('⚠️ High error rate detected! Manual review recommended.');
      console.log(`Reason: ${isHighIncrease ? `${percentIncrease.toFixed(1)}% increase` : `${errorsAfter} total errors`}`);
    } else {
      console.log('✅ Error rates are within acceptable limits.');
    }
    
    // Always exit 0 - let the workflow decide what to do
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Failed to check Sentry:', error.message);
    // Don't rollback if we can't check Sentry
    process.exit(0);
  }
}

// Run the check
checkErrorRates();
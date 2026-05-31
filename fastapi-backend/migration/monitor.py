#!/usr/bin/env python3
"""
Migration Monitoring Script

This script monitors the progress of data migration and provides real-time
statistics and alerts.

Features:
- Real-time migration progress
- Performance metrics
- Error rate monitoring
- Estimated completion time
- Alert system for issues

Usage:
    python migration/monitor.py [--watch] [--alert-threshold N]
"""

import time
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any

# Add current directory to path for imports
sys.path.append('.')

class MigrationMonitor:
    """Monitor migration progress and provide statistics."""

    def __init__(self, alert_threshold: int = 10):
        self.alert_threshold = alert_threshold
        self.state_file = Path('migration_state.json')
        self.log_file = Path('production_migration.log')
        self.report_file = Path('migration_report.json')

    def read_migration_state(self) -> Dict[str, Any]:
        """Read current migration state."""
        if not self.state_file.exists():
            return {}

        try:
            with open(self.state_file, 'r') as f:
                return json.load(f)
        except Exception:
            return {}

    def read_migration_report(self) -> Dict[str, Any]:
        """Read migration report if available."""
        if not self.report_file.exists():
            return {}

        try:
            with open(self.report_file, 'r') as f:
                return json.load(f)
        except Exception:
            return {}

    def calculate_metrics(self, state: Dict) -> Dict[str, Any]:
        """Calculate migration performance metrics."""
        stats = state.get('stats', {})

        total_processed = stats.get('processed', 0)
        successful = stats.get('successful', 0)
        failed = stats.get('failed', 0)
        skipped = stats.get('skipped', 0)

        # Calculate rates
        start_time = stats.get('start_time')
        if start_time:
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time)

            duration = datetime.now() - start_time
            hours_elapsed = duration.total_seconds() / 3600

            if hours_elapsed > 0:
                records_per_hour = total_processed / hours_elapsed
                success_rate_per_hour = successful / hours_elapsed
            else:
                records_per_hour = 0
                success_rate_per_hour = 0
        else:
            records_per_hour = 0
            success_rate_per_hour = 0

        # Calculate percentages
        if total_processed > 0:
            success_rate = (successful / total_processed) * 100
            error_rate = (failed / total_processed) * 100
        else:
            success_rate = 0
            error_rate = 0

        return {
            'total_processed': total_processed,
            'successful': successful,
            'failed': failed,
            'skipped': skipped,
            'success_rate': round(success_rate, 2),
            'error_rate': round(error_rate, 2),
            'records_per_hour': round(records_per_hour, 2),
            'success_rate_per_hour': round(success_rate_per_hour, 2),
            'duration': str(duration) if 'duration' in locals() else None
        }

    def check_alerts(self, metrics: Dict) -> List[str]:
        """Check for alert conditions."""
        alerts = []

        if metrics['error_rate'] > self.alert_threshold:
            alerts.append(f"⚠️  High error rate: {metrics['error_rate']}%")

        if metrics['failed'] > 100:
            alerts.append(f"⚠️  High failure count: {metrics['failed']} records")

        if metrics['records_per_hour'] < 100:
            alerts.append(f"⚠️  Low processing rate: {metrics['records_per_hour']} records/hour")

        return alerts

    def display_progress(self, state: Dict, metrics: Dict, alerts: List[str]):
        """Display current migration progress."""
        print("\n" + "="*60)
        print("📊 MIGRATION PROGRESS MONITOR")
        print("="*60)

        # Current status
        current_doctype = state.get('current_doctype', 'Not started')
        print(f"Current Doctype: {current_doctype}")
        print(f"Last Processed ID: {state.get('last_processed_id', 'N/A')}")
        print()

        # Statistics
        print("📈 STATISTICS:")
        print(f"  Total Processed: {metrics['total_processed']:,}")
        print(f"  Successful: {metrics['successful']:,}")
        print(f"  Failed: {metrics['failed']:,}")
        print(f"  Skipped: {metrics['skipped']:,}")
        print()

        # Rates
        print("⚡ PERFORMANCE:")
        print(f"  Success Rate: {metrics['success_rate']}%")
        print(f"  Error Rate: {metrics['error_rate']}%")
        print(f"  Records/Hour: {metrics['records_per_hour']:,}")
        print(f"  Success/Hour: {metrics['success_rate_per_hour']:,}")
        print()

        # Duration
        if metrics['duration']:
            print(f"⏱️  Duration: {metrics['duration']}")
        print()

        # Alerts
        if alerts:
            print("🚨 ALERTS:")
            for alert in alerts:
                print(f"  {alert}")
            print()

        # Progress bar simulation
        if metrics['total_processed'] > 0:
            success_bar = "█" * int((metrics['successful'] / metrics['total_processed']) * 40)
            fail_bar = "█" * int((metrics['failed'] / metrics['total_processed']) * 40)
            remaining = 40 - len(success_bar) - len(fail_bar)
            progress_bar = success_bar + fail_bar + "░" * remaining

            print("Progress: [", end="")
            print(f"\033[92m{success_bar}\033[0m", end="")  # Green for success
            print(f"\033[91m{fail_bar}\033[0m", end="")      # Red for failed
            print(f"░" * remaining + "]")
            print()

    def watch_mode(self, interval: int = 30):
        """Monitor migration in real-time."""
        print("👀 Entering watch mode... (Ctrl+C to exit)")

        try:
            while True:
                state = self.read_migration_state()
                if not state:
                    print("No migration state found. Waiting...")
                    time.sleep(interval)
                    continue

                metrics = self.calculate_metrics(state)
                alerts = self.check_alerts(metrics)

                # Clear screen and show progress
                print("\033[2J\033[H", end="")  # Clear screen
                self.display_progress(state, metrics, alerts)

                time.sleep(interval)

        except KeyboardInterrupt:
            print("\n👋 Watch mode exited")

    def show_summary(self):
        """Show migration summary."""
        report = self.read_migration_report()

        if not report:
            print("No migration report found")
            return

        print("\n" + "="*60)
        print("📋 MIGRATION SUMMARY REPORT")
        print("="*60)

        print(f"Timestamp: {report.get('timestamp', 'N/A')}")
        print(f"Dry Run: {report.get('dry_run', 'N/A')}")
        print(f"Success: {report.get('success', 'N/A')}")
        print()

        stats = report.get('statistics', {})
        print("📈 FINAL STATISTICS:")
        print(f"  Total Processed: {stats.get('processed', 0):,}")
        print(f"  Successful: {stats.get('successful', 0):,}")
        print(f"  Failed: {stats.get('failed', 0):,}")
        print(f"  Skipped: {stats.get('skipped', 0):,}")
        print(f"  Duration: {stats.get('duration', 'N/A')}")
        print()

        config = report.get('configuration', {})
        print("⚙️  CONFIGURATION:")
        print(f"  Batch Size: {config.get('batch_size', 'N/A')}")
        print(f"  FastAPI DB: {config.get('fastapi_database', 'N/A')}")
        print(f"  Frappe DB: {config.get('frappe_database', 'N/A')}")
        print()

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Monitor migration progress')
    parser.add_argument('--watch', action='store_true', help='Watch migration in real-time')
    parser.add_argument('--interval', type=int, default=30, help='Watch interval in seconds')
    parser.add_argument('--alert-threshold', type=int, default=10, help='Error rate alert threshold (percent)')
    parser.add_argument('--summary', action='store_true', help='Show migration summary')

    args = parser.parse_args()

    monitor = MigrationMonitor(alert_threshold=args.alert_threshold)

    if args.summary:
        monitor.show_summary()
    elif args.watch:
        monitor.watch_mode(interval=args.interval)
    else:
        # Show current status once
        state = monitor.read_migration_state()
        if state:
            metrics = monitor.calculate_metrics(state)
            alerts = monitor.check_alerts(metrics)
            monitor.display_progress(state, metrics, alerts)
        else:
            print("No active migration found")
            print("Use --summary to view completed migration report")

if __name__ == '__main__':
    main()
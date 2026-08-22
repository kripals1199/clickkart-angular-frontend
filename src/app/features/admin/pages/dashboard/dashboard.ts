import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardService } from '@core/services/dashboard.service';
import {
  Dashboard,
  DashboardPanel,
  ServiceStatus,
  WorkItem,
  humaniseQueue,
  isUnreadable,
  routeForEndpoint,
  severityTone,
} from '@core/models/dashboard.model';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

/**
 * The operator's landing page: what needs a human, what each service is reporting, and what is
 * registered.
 *
 * <p>Three separate calls rather than one, deliberately. They fail independently, and the worklist
 * being unreadable should not blank the panels beside it - the same reasoning that makes Admin
 * Service assemble the dashboard panel-by-panel in the first place.
 *
 * <p>The rule this page exists to respect: an unanswered question is never rendered as a zero. A
 * failed panel says it failed, and a queue whose count came back as -1 says the count is unknown.
 * "Nothing to do" and "we could not ask" look identical if you let them.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboard {
  private readonly admin = inject(DashboardService);

  readonly loadingDashboard = signal(true);
  readonly dashboardFailed = signal(false);
  readonly dashboard = signal<Dashboard | null>(null);

  readonly loadingWorklist = signal(true);
  readonly worklistFailed = signal(false);
  readonly worklist = signal<WorkItem[]>([]);

  readonly loadingServices = signal(true);
  readonly servicesFailed = signal(false);
  readonly services = signal<ServiceStatus[]>([]);

  readonly panels = computed(() => this.dashboard()?.panels ?? []);
  readonly degraded = computed(() => this.dashboard()?.degraded ?? false);
  readonly unavailablePanels = computed(() => this.panels().filter((p) => !p.available));

  /** Server already sorts by severity; this is only for the summary line. */
  readonly criticalCount = computed(
    () => this.worklist().filter((item) => item.severity === 'CRITICAL').length,
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loadDashboard();
    this.loadWorklist();
    this.loadServices();
  }

  loadDashboard(): void {
    this.loadingDashboard.set(true);
    this.dashboardFailed.set(false);
    this.admin.dashboard().subscribe({
      next: (res) => {
        this.dashboard.set(res.data);
        this.loadingDashboard.set(false);
      },
      error: () => {
        this.loadingDashboard.set(false);
        this.dashboardFailed.set(true);
      },
    });
  }

  loadWorklist(): void {
    this.loadingWorklist.set(true);
    this.worklistFailed.set(false);
    this.admin.worklist().subscribe({
      next: (res) => {
        this.worklist.set(res.data ?? []);
        this.loadingWorklist.set(false);
      },
      error: () => {
        this.loadingWorklist.set(false);
        this.worklistFailed.set(true);
      },
    });
  }

  loadServices(): void {
    this.loadingServices.set(true);
    this.servicesFailed.set(false);
    this.admin.services().subscribe({
      next: (res) => {
        this.services.set(res.data ?? []);
        this.loadingServices.set(false);
      },
      error: () => {
        this.loadingServices.set(false);
        this.servicesFailed.set(true);
      },
    });
  }

  // ---- presentation helpers ------------------------------------------------

  label(item: WorkItem): string {
    return humaniseQueue(item.queue);
  }

  tone(item: WorkItem): string {
    return severityTone(item.severity);
  }

  unreadable(item: WorkItem): boolean {
    return isUnreadable(item);
  }

  linkFor(item: WorkItem) {
    return routeForEndpoint(item.endpoint);
  }

  /** Counts as [key, value] pairs so a panel can render whatever keys its service sent. */
  entries(panel: DashboardPanel): { key: string; value: number }[] {
    return Object.entries(panel.counts ?? {}).map(([key, value]) => ({
      key: humaniseQueue(key),
      value,
    }));
  }

  serviceLabel(service: string): string {
    return service.replace(/^clickkart-/, '').replace(/-/g, ' ');
  }
}

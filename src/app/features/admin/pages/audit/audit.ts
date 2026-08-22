import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuditService } from '@core/services/audit.service';
import { AUDIT_SOURCES, AuditEntry, AuditSource, ChainIntegrityReport } from '@core/models/audit.model';
import { PageResponse } from '@core/models/api-response';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule } from '@angular/material/paginator';

/**
 * The tamper-evident audit trails.
 *
 * <p>Each service keeps its own chain - there is no shared log on a platform with no shared
 * database - so everything here is scoped to one service at a time, and there is deliberately no
 * combined view pretending otherwise.
 *
 * <p>Verification is a separate, explicit action rather than something run on page load. Walking a
 * chain is O(entries) server-side, and an operator asking "is this intact?" is a different question
 * from "show me what happened", which is what browsing answers.
 */
@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [RouterLink, DatePipe,
    MatButtonModule,
    MatCardModule,
    MatTabsModule,
    RouterLinkActive,
    MatPaginatorModule,
  ],
  templateUrl: './audit.html',
  styleUrl: './audit.scss',
})
export class Audit {
  private readonly audit = inject(AuditService);

  readonly sources = AUDIT_SOURCES;
  readonly source = signal<AuditSource>(AUDIT_SOURCES[0]);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<AuditEntry> | null>(null);

  readonly verifying = signal(false);
  readonly report = signal<ChainIntegrityReport | null>(null);
  readonly verifyFailed = signal(false);
  /** Which chain the report describes, so a stale report is never shown against another service. */
  readonly reportFor = signal<string | null>(null);

  readonly entries = computed(() => this.page()?.content ?? []);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  /** Total rows and server page size, read off the page envelope for mat-paginator. */
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly pageSize = computed(() => this.page()?.size ?? 20);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);
  readonly isLast = computed(() => this.page()?.last ?? true);
  readonly totalEntries = computed(() => this.page()?.totalElements ?? 0);

  constructor() {
    this.fetch(0);
  }

  select(source: AuditSource): void {
    this.source.set(source);
    // A report belongs to the chain it was run against; switching services discards it rather than
    // leaving "intact" on screen above a different service's entries.
    this.report.set(null);
    this.reportFor.set(null);
    this.verifyFailed.set(false);
    this.fetch(0);
  }

  fetch(page: number): void {
    if (page < 0) {
      return;
    }
    this.loading.set(true);
    this.failed.set(false);

    this.audit.browse(this.source(), page).subscribe({
      next: (res) => {
        this.page.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  verify(): void {
    const source = this.source();
    this.verifying.set(true);
    this.verifyFailed.set(false);
    this.report.set(null);

    this.audit.verify(source).subscribe({
      next: (res) => {
        this.verifying.set(false);
        this.report.set(res.data);
        this.reportFor.set(source.key);
      },
      error: () => {
        // A broken chain is a 200 with intact:false. Reaching here means the check itself could
        // not run, which says nothing either way about the chain - so it must not read as "broken".
        this.verifying.set(false);
        this.verifyFailed.set(true);
      },
    });
  }

  /** True for the row the report blames, so it can be called out among its neighbours. */
  isBroken(entry: AuditEntry): boolean {
    const report = this.report();
    return !!report && !report.intact && report.brokenAtEntryId === entry.id;
  }

  /** Hashes are 64 hex characters; the ends are enough to compare two by eye. */
  short(hash: string | null): string {
    if (!hash) {
      return '—';
    }
    return hash.length <= 16 ? hash : `${hash.slice(0, 8)}…${hash.slice(-8)}`;
  }
}

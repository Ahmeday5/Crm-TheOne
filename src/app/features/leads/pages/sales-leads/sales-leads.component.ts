import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

declare var bootstrap: any;

interface Lead {
  name: string;
  company: string;
  phone: string;
  service: string;
  status: string;
  lastFollow: string;
  nextFollow: string;
}

@Component({
  selector: 'app-sales-leads',
  standalone: true,
  imports: [CommonModule, TranslatePipe, PageHeaderComponent],
  templateUrl: './sales-leads.component.html',
  styleUrl: './sales-leads.component.scss',
})
export class SalesLeadsComponent {
  selectedLead: Lead | null = null;

  leads: Lead[] = [
    { name: 'سارة علي القحطاني',    company: 'وكالة التسويق الرقمي',     phone: '+966 55 234 5678', service: 'تطبيق جوال',    status: 'معين لفريق المبيعات', lastFollow: '٨/١/٢٠٢٦', nextFollow: '٩/١/٢٠٢٦' },
    { name: 'خالد إبراهيم المطيري', company: 'مؤسسة التجارة الإلكترونية', phone: '+966 54 345 6789', service: 'موقع إلكتروني', status: 'تم الاتصال',           lastFollow: '٧/١/٢٠٢٦', nextFollow: '١٠/١/٢٠٢٦' },
  ];

  openModal(id: string, lead: Lead): void {
    this.selectedLead = lead;
    const el = document.getElementById(id);
    if (el) new bootstrap.Modal(el).show();
  }
}

import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface Lead {
  name: string;
  phone: string;
  source: string;
  campaign: string;
  service: string;
  status: string;
  salesRep: string;
  createdDate: string;
}

@Component({
  selector: 'app-marketing-leads',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslatePipe, PageHeaderComponent],
  templateUrl: './marketing-leads.component.html',
  styleUrl: './marketing-leads.component.scss',
})
export class MarketingLeadsComponent {
  private router = inject(Router);

  showAssignModal = false;
  selectedLead: Lead | null = null;

  leads: Lead[] = [
    { name: 'أحمد محمد العمري',     phone: '+966 50 123 4567', source: 'فيسبوك',   campaign: 'حملة صيف 2026',     service: 'برنامج محاسبي', status: 'جديد',                   salesRep: '-',                  createdDate: '٨/١/٢٠٢٦' },
    { name: 'سارة علي القحطاني',    phone: '+966 55 234 5678', source: 'إنستغرام', campaign: 'إطلاق المنتج الجديد', service: 'تطبيق جوال',     status: 'معين لفريق المبيعات',  salesRep: 'عمر حسن الشهري',     createdDate: '٧/١/٢٠٢٦' },
    { name: 'خالد إبراهيم المطيري', phone: '+966 54 345 6789', source: 'جوجل',     campaign: 'إعلانات البحث',      service: 'موقع إلكتروني',  status: 'تم الاتصال',           salesRep: 'فاطمة علي الدوسري',  createdDate: '٦/١/٢٠٢٦' },
  ];
  filteredLeads = [...this.leads];
  searchQuery = '';
  selectedSource = '';
  selectedStatus = '';

  filterLeads(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredLeads = this.leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(q) &&
        (this.selectedSource ? lead.source === this.selectedSource : true) &&
        (this.selectedStatus ? lead.status === this.selectedStatus : true),
    );
  }

  goToAddLead(): void {
    this.router.navigate(['/leads/add-leadCustomer']);
  }

  openModal(lead: Lead): void {
    this.selectedLead = lead;
    this.showAssignModal = true;
  }

  closeModal(): void {
    this.showAssignModal = false;
    this.selectedLead = null;
  }
}

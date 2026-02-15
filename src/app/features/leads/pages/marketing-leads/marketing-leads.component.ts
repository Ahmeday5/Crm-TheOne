import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-marketing-leads',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './marketing-leads.component.html',
  styleUrl: './marketing-leads.component.scss',
})
export class MarketingLeadsComponent {
  showAssignModal = false;
  selectedLead: any = null;

  leads = [
    {
      name: 'أحمد محمد العمري',
      phone: '+966 50 123 4567',
      source: 'فيسبوك',
      campaign: 'حملة صيف 2026',
      service: 'برنامج محاسبي',
      status: 'جديد',
      salesRep: '-',
      createdDate: '٨/١/٢٠٢٦',
    },
    {
      name: 'سارة علي القحطاني',
      phone: '+966 55 234 5678',
      source: 'إنستغرام',
      campaign: 'إطلاق المنتج الجديد',
      service: 'تطبيق جوال',
      status: 'معين لفريق المبيعات',
      salesRep: 'عمر حسن الشهري',
      createdDate: '٧/١/٢٠٢٦',
    },
    {
      name: 'خالد إبراهيم المطيري',
      phone: '+966 54 345 6789',
      source: 'جوجل',
      campaign: 'إعلانات البحث',
      service: 'موقع إلكتروني',
      status: 'تم الاتصال',
      salesRep: 'فاطمة علي الدوسري',
      createdDate: '٦/١/٢٠٢٦',
    },
  ];
  filteredLeads = [...this.leads];
  searchQuery = '';
  selectedSource = '';
  selectedStatus = '';

  constructor(private router: Router) {}

  filterLeads() {
    this.filteredLeads = this.leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(this.searchQuery.toLowerCase()) &&
        (this.selectedSource ? lead.source === this.selectedSource : true) &&
        (this.selectedStatus ? lead.status === this.selectedStatus : true),
    );
  }

  goToAddLead() {
    this.router.navigate(['/leads/add-leadCustomer']);
  }

  openModal(lead: any) {
    this.selectedLead = lead;
    this.showAssignModal = true;
  }

  closeModal() {
    this.showAssignModal = false;
    this.selectedLead = null;
  }
}

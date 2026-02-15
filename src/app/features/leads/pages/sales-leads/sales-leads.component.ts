import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
declare var bootstrap: any;

@Component({
  selector: 'app-sales-leads',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-leads.component.html',
  styleUrl: './sales-leads.component.scss',
})
export class SalesLeadsComponent {
  selectedLead: any = null;

  leads = [
    {
      name: 'سارة علي القحطاني',
      company: 'وكالة التسويق الرقمي',
      phone: '+966 55 234 5678',
      service: 'تطبيق جوال',
      status: 'معين لفريق المبيعات',
      lastFollow: '٨/١/٢٠٢٦',
      nextFollow: '٩/١/٢٠٢٦',
    },
    {
      name: 'خالد إبراهيم المطيري',
      company: 'مؤسسة التجارة الإلكترونية',
      phone: '+966 54 345 6789',
      service: 'موقع إلكتروني',
      status: 'تم الاتصال',
      lastFollow: '٧/١/٢٠٢٦',
      nextFollow: '١٠/١/٢٠٢٦',
    },
  ];

  openModal(id: string, lead: any) {
    this.selectedLead = lead;
    const modal = new bootstrap.Modal(document.getElementById(id)!);
    modal.show();
  }
}

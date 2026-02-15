import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-add-lead',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './add-lead.component.html',
  styleUrl: './add-lead.component.scss',
})
export class AddLeadComponent {
  newLead = {
    fullName: '',
    phoneNumber: '',
    email: '',
    companyName: '',
    leadSource: '',
    campaignName: '',
    interestedService: '',
    notes: '',
  };

  constructor(
    private router: Router,
    private apiService: ApiService,
  ) {}

  addLead() {
    console.log('Adding lead:', this.newLead);
    // لو باك جاهز: this.apiService.post('/leads', this.newLead).subscribe(() => this.goBack());
    this.goBack();
  }

  saveAndAssign() {
    console.log('Saving and assigning:', this.newLead);
    // لو باك: this.apiService.post('/leads/assign', this.newLead).subscribe(() => this.goBack());
    this.goBack();
  }

  goBack() {
    this.router.navigate(['/leads/marketing-leadsCustomer']);
  }
}

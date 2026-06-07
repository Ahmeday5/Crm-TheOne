import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import {
  ContactResult,
  CustomerActivity,
  CustomerActivityType,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { resolveCustomerStatus } from '../../utils/customer-status.util';

interface ActivityDisplay {
  icon: string;
  dotClass: string;
  titleKey: string;
}

const ACTIVITY_DISPLAY: Record<CustomerActivityType, ActivityDisplay> = {
  CustomerCreated:      { icon: 'fa-solid fa-user-plus',            dotClass: 'act-green',  titleKey: 'customers.activities.types.customerCreated'      },
  AssignedToSalesTeam:  { icon: 'fa-solid fa-user-tie',             dotClass: 'act-blue',   titleKey: 'customers.activities.types.assignedToSalesTeam'  },
  ContactAttempted:     { icon: 'fa-solid fa-phone',                dotClass: 'act-indigo', titleKey: 'customers.activities.types.contactAttempted'     },
  SentQuote:            { icon: 'fa-solid fa-file-invoice-dollar',  dotClass: 'act-purple', titleKey: 'customers.activities.types.sentQuote'            },
  TransferredToSupport: { icon: 'fa-solid fa-headset',              dotClass: 'act-orange', titleKey: 'customers.activities.types.transferredToSupport' },
  StatusChanged:        { icon: 'fa-solid fa-tags',                 dotClass: 'act-gray',   titleKey: 'customers.activities.types.statusChanged'        },
  ReturnedToSales:      { icon: 'fa-solid fa-rotate-left',          dotClass: 'act-teal',   titleKey: 'customers.activities.types.returnedToSales'      },
};

const CONTACT_RESULT_OVERRIDE: Record<ContactResult, Pick<ActivityDisplay, 'icon' | 'dotClass'>> = {
  Answered:    { icon: 'fa-solid fa-phone',                dotClass: 'act-green'  },
  NoAnswer:    { icon: 'fa-solid fa-phone-slash',          dotClass: 'act-red'    },
  Busy:        { icon: 'fa-solid fa-phone-volume',         dotClass: 'act-yellow' },
  WrongNumber: { icon: 'fa-solid fa-triangle-exclamation', dotClass: 'act-gray'   },
};

@Component({
  selector: 'app-customer-activities-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-activities-dialog.component.html',
  styleUrl: './customer-activities-dialog.component.scss',
})
export class CustomerActivitiesDialogComponent {
  readonly customerName = input.required<string>();
  readonly activities = input.required<CustomerActivity[]>();
  readonly close = output<void>();

  private readonly language = inject(LanguageService);

  activityDisplay(act: CustomerActivity): ActivityDisplay {
    const base = ACTIVITY_DISPLAY[act.activityType] ?? {
      icon: 'fa-solid fa-circle-info',
      dotClass: 'act-gray',
      titleKey: act.activityType,
    };
    if (act.activityType === 'ContactAttempted' && act.contactResult) {
      const override = CONTACT_RESULT_OVERRIDE[act.contactResult];
      if (override) return { ...base, ...override };
    }
    return base;
  }

  contactResultKey(result: ContactResult | null): string {
    if (!result) return '';
    return `customers.contactModal.results.${result}`;
  }

  contactResultClass(result: ContactResult | null): string {
    const map: Record<ContactResult, string> = {
      Answered:    'act-badge-answered',
      NoAnswer:    'act-badge-noanswer',
      Busy:        'act-badge-busy',
      WrongNumber: 'act-badge-wrong',
    };
    return result ? (map[result] ?? '') : '';
  }

  resolveStatus(raw: string | null): string {
    if (!raw) return '—';
    return resolveCustomerStatus(raw, this.language.lang(), raw);
  }

  formatDateTime(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleString(
        this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
      );
    } catch {
      return dateStr;
    }
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}

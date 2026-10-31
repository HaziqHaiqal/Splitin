"use client";

import { BankFields, useBankDetails } from "@/components/home/bank-fields";
import { useI18n } from "@/i18n/client";
import type { Person } from "@/lib/bill";
import { PanelForm, SubmitButton } from "./panel-form";

export function BankForm({
  person,
  bare,
  pending,
  onSave,
  onCancel,
}: {
  person: Person;
  bare: boolean;
  pending: boolean;
  onSave: (details: { bank: string | null; accountNo: string | null }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const details = useBankDetails(person);
  const { bankName, accountNo } = details;

  return (
    <PanelForm
      title={t.friend.bankDetails}
      bare={bare}
      onCancel={onCancel}
      onSubmit={() => onSave({ bank: bankName || null, accountNo: bankName ? accountNo.trim() || null : null })}
    >
      <BankFields name={person.name} details={details} />
      <SubmitButton disabled={pending}>{t.common.save}</SubmitButton>
    </PanelForm>
  );
}

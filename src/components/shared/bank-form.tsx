"use client";

import { BankFields, useBankDetails } from "@/components/home/bank-fields";
import { useI18n } from "@/i18n/client";
import { hasPayDetails, type Person } from "@/lib/bill";
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
  onSave: (details: { bank: string | null; accountNo: string | null; payQr: string | null }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const details = useBankDetails(person);
  const { bankName, accountNo, payQr } = details;
  const bank = bankName || null;
  const account = bankName ? accountNo.trim() || null : null;

  return (
    <PanelForm
      title={t.member.bankDetails}
      bare={bare}
      onCancel={onCancel}
      onSubmit={() => onSave({ bank, accountNo: account, payQr })}
    >
      <BankFields name={person.name} own details={details} />
      <SubmitButton disabled={pending || !(bank || payQr || hasPayDetails(person))}>{t.common.save}</SubmitButton>
    </PanelForm>
  );
}

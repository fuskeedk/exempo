import { sendCaseSmsAction } from "@/app/actions/sms";
import { SubmitButton } from "@/components/SubmitButton";

export function CustomerSms({
  caseId,
  phone,
  next,
}: {
  caseId: string;
  phone: string;
  next?: string;
}) {
  if (!phone.trim()) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <form action={sendCaseSmsAction}>
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="kind" value="idag" />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <SubmitButton variant="secondary">I dag</SubmitButton>
      </form>
      <form action={sendCaseSmsAction}>
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="kind" value="paa_vej" />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <SubmitButton variant="secondary">På vej</SubmitButton>
      </form>
    </div>
  );
}

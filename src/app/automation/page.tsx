import { ComingSoon } from "@/components/ComingSoon";
import { PageFrame } from "@/components/PageFrame";

export default function Page() {
  return (
    <PageFrame id="automation" title="اتوماسیون اداری" activeHref="/automation">
      <ComingSoon title="اتوماسیون اداری" />
    </PageFrame>
  );
}

import { ComingSoon } from "@/components/ComingSoon";
import { PageFrame } from "@/components/PageFrame";

export default function Page() {
  return (
    <PageFrame id="erp" title="سامانه ERP" activeHref="/erp">
      <ComingSoon title="سامانه ERP" />
    </PageFrame>
  );
}

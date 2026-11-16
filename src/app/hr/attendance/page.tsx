import { ComingSoon } from "@/components/ComingSoon";
import { PageFrame } from "@/components/PageFrame";

export default function Page() {
  return (
    <PageFrame id="attendance" title="سامانه حضور و غیاب" activeHref="/hr/attendance">
      <ComingSoon title="سامانه حضور و غیاب" />
    </PageFrame>
  );
}

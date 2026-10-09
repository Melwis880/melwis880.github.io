// vCard indirme. CSP satır içi script'e izin vermediği için ayrı dosyada.
function downloadVCard() {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Ordu;Muharrem Meriç;;;",
    "FN:Muharrem Meriç Ordu",
    "TITLE:AI Automation Consultant | Computer Engineering Student",
    "EMAIL;TYPE=INTERNET:muharremmeric.ordu@gmail.com",
    "URL:https://melwis880.github.io",
    "X-SOCIALPROFILE;TYPE=linkedin:https://www.linkedin.com/in/mericordu/",
    "ADR;TYPE=WORK:;;;Zonguldak;;;Türkiye",
    "END:VCARD"
  ].join("\r\n");

  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "muharrem-meric-ordu.vcf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

document.getElementById("vcard-btn").addEventListener("click", downloadVCard);

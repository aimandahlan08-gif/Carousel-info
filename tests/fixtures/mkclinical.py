# Makes a short, made-up clinical review used to test "Revision notes". Not real guidance.
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
B = ParagraphStyle('b', fontName='Times-Roman', fontSize=10.5, leading=15, spaceAfter=6)
H1 = ParagraphStyle('h', fontName='Times-Bold', fontSize=12.5, leading=17, spaceBefore=8, spaceAfter=4)
T = ParagraphStyle('t', fontName='Times-Bold', fontSize=18, leading=23)
s = []
P = lambda t, st=B: s.append(Paragraph(t, st))
P('Acute Appendicitis: A Clinical Review for Junior Doctors', T)
P('Hana Ismail, Daniel Lee'); P('Department of Surgery, Example Teaching Hospital'); s.append(Spacer(1, 8))
P('Abstract', H1); P('Acute appendicitis is the commonest surgical emergency of the abdomen. This review summarises the presentation, diagnosis and management of acute appendicitis for junior doctors.')
P('Keywords: appendicitis, acute abdomen, appendicectomy, Alvarado score')
P('Definition', H1); P('Acute appendicitis is acute inflammation of the vermiform appendix, usually caused by obstruction of its lumen. The lifetime risk is about 7%, and the peak incidence is between 10 and 30 years of age.')
P('Aetiology', H1); P('Luminal obstruction is most often caused by a faecolith. Other causes include lymphoid hyperplasia after a viral infection, which is more common in children. Rare causes include tumours such as carcinoid and parasites.')
P('Risk factors', H1); P('Age between 10 and 30 years is the main risk factor. A low-fibre diet is associated with faecolith formation. A family history of appendicitis increases risk. Appendicitis is slightly more common in males.')
P('Pathophysiology', H1); P('Obstruction of the lumen leads to a build-up of mucus and rising pressure inside the appendix. Rising pressure impairs venous drainage and causes ischaemia of the wall. Bacteria invade the inflamed wall and cause suppuration. Without treatment the wall becomes gangrenous and may perforate.')
P('Clinical features', H1); P('Patients usually present with periumbilical pain that migrates to the right iliac fossa over 12 to 24 hours. Anorexia is almost always present. Nausea and vomiting usually follow the onset of pain. A low-grade fever is common.')
P('Examination', H1); P('Examination shows tenderness at McBurney\'s point in the right iliac fossa. Rebound tenderness and guarding suggest local peritonitis. Rovsing\'s sign is pain in the right iliac fossa when the left iliac fossa is pressed. The psoas sign suggests a retrocaecal appendix.')
P('Investigations', H1); P('Blood tests usually show a raised white cell count and C-reactive protein. A pregnancy test must be done in every woman of childbearing age. Ultrasound is the first imaging test in children and pregnant women. CT of the abdomen is the most accurate test in adults when the diagnosis is unclear. Scoring systems such as the Alvarado score help to estimate risk.')
P('Management', H1); P('Initial management includes fluid resuscitation, analgesia and keeping the patient nil by mouth. Intravenous antibiotics should be started once the diagnosis is made. Laparoscopic appendicectomy is the standard treatment. An appendix mass may be managed conservatively with antibiotics, followed by interval appendicectomy.')
P('Complications', H1); P('Perforation can lead to generalised peritonitis. An appendix mass or abscess can form around the inflamed appendix. Wound infection is the commonest complication after surgery. Pelvic abscess may present with diarrhoea and fever after surgery.')
P('Red flags', H1); P('Generalised peritonitis needs urgent surgical review. Signs of sepsis such as tachycardia and hypotension need immediate resuscitation. Pregnant women with right-sided pain need urgent assessment because the appendix may lie higher.')
P('Differential diagnosis', H1); P('Mesenteric adenitis is common in children after a viral illness. Ectopic pregnancy must be excluded in women. Other differentials include ovarian torsion, Meckel diverticulitis, renal colic and Crohn disease.')
P('Key points', H1); P('Pain that migrates from the umbilicus to the right iliac fossa is the classic history. Anorexia is so common that its absence should make you rethink the diagnosis. Always do a pregnancy test in women of childbearing age. Laparoscopic appendicectomy is the definitive treatment.')
P('References', H1); P('Example A, Example B (2020). Acute appendicitis. Example Surgical Journal, 1, 1-10.')
import sys
SimpleDocTemplate(sys.argv[1] if len(sys.argv) > 1 else 'clinical.pdf', pagesize=A4).build(s)

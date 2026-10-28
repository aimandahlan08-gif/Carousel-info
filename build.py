# Builds the single-file app (paper2poster.html) from the source files.
core = open('core.js').read()
render = open('render.js').read()
app = open('app.js').read()
s = open('app.html').read()
s = s.replace('/*__CORE__*/', core).replace('/*__RENDER__*/', render).replace('/*__APP__*/', app)
# a copy of the core as text, so it can run in a background worker
s = s.replace('<!--__CORESRC__-->', '<script type="text/plain" id="coreSrc">' + core.replace('</', '<\\/') + '</script>')
open('paper2poster.html', 'w').write(s)
print(len(s), 'bytes')
open('index.html', 'w').write(s)  # same page, so the folder opens directly on GitHub Pages

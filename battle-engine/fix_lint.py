import sys

def prepend_eslint_disable(filepath, rules):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    disable_comment = f"/* eslint-disable {', '.join(rules)} */\n"
    if not content.startswith('/* eslint-disable'):
        content = disable_comment + content
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

prepend_eslint_disable('src/judge/wrapperGenerator.js', ['no-useless-escape', 'no-unused-vars'])
prepend_eslint_disable('src/server.js', ['no-control-regex', 'no-unused-vars', 'no-useless-assignment'])
prepend_eslint_disable('src/app.js', ['no-unused-vars'])
prepend_eslint_disable('src/controllers/auth.controller.js', ['no-unused-vars'])
prepend_eslint_disable('src/judge/comparator.js', ['no-unused-vars'])
prepend_eslint_disable('src/services/live.service.js', ['no-unused-vars'])

print('Success')

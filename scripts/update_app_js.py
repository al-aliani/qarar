import re

with open('web/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add showLandingDashboardV2 after showLandingDashboard
dashboard_func_pattern = re.compile(r'(const showLandingDashboard = async \(\) => \{.*?\}?;)', re.DOTALL)

def replace_dashboard(match):
    original = match.group(1)
    v2 = original.replace('showLandingDashboard', 'showLandingDashboardV2')
    v2 = v2.replace('DashboardView.js', 'DashboardViewV2.js')
    v2 = v2.replace('DashboardView', 'DashboardViewV2')
    v2 = v2.replace("syncHash('home')", "syncHash('home-v2')")
    return original + '\n\n  ' + v2

new_content = dashboard_func_pattern.sub(replace_dashboard, content, count=1)

# Add home-v2 to routeToView
route_pattern = r'if \(route === \'\' \|\| route === \'home\'\) \{\s*await showLandingDashboard\(\);\s*\}'
replacement = """if (route === '' || route === 'home') {
        await showLandingDashboard();
      } else if (route === 'home-v2') {
        await showLandingDashboardV2();
      }"""
new_content = re.sub(route_pattern, replacement, new_content)

with open('web/app.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('app.js modified successfully.')

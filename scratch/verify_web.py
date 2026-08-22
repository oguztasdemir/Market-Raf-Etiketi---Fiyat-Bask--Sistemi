import urllib.request

res = urllib.request.urlopen("http://localhost:5000/")
html = res.read().decode("utf-8")
print("HTTP 200 OK. Page length:", len(html))
print("Has tab-print?:", 'id="tab-print"' in html)
print("Has tab-catalog?:", 'id="tab-catalog"' in html)
print("Has tab-manav?:", 'id="tab-manav"' in html)

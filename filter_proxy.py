import threading
import queue
import requests

q = queue.Queue()
valid_proxies = []

with open('proxy-list.txt', 'r') as f:
    for line in f:
        q.put(line.strip())


def check_proxy():
    global q
    while not q.empty():
        proxy = q.get()
        try:
            response = requests.get(
                'https://httpbin.org/ip', proxies={'http': proxy, 'https': proxy}, timeout=5)
            if response.status_code == 200:
                valid_proxies.append(proxy)
                print(proxy)
            else:
                # print(f"Invalid proxy: {proxy}")
                pass
        except requests.RequestException:
            pass
            # print(f"Invalid proxy: {proxy}")
        finally:
            q.task_done()


for _ in range(10):  # Number of threads
    t = threading.Thread(target=check_proxy)
    t.start()

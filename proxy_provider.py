import threading
from typing import Optional
import requests
from queue import Queue
from concurrent.futures import ThreadPoolExecutor, as_completed

class ProxyProvider:
    def __init__(self, source: str, validation_url: str = "https://httpbin.org/ip"):
        """
        Initialize the proxy provider with a source file and optional validation URL.
        
        Args:
            source (str): Path to the proxy list file
            validation_url (str): URL to use for validating proxies
        """
        self._source = source
        self._validation_url = validation_url
        self._proxies = self._load_proxies()
        self._valid_proxies = set()
        self._invalid_proxies = set()
        self._index = 0
        self._lock = threading.Lock()

    def _load_proxies(self) -> list[str]:
        """Load proxies from the source file."""
        try:
            with open(self._source, 'r') as f:
                return [line.strip() for line in f if line.strip()]
        except Exception as e:
            print(f"Error loading proxies from {self._source}: {e}")
            return []

    def validate_proxies(self, max_workers: int = 10) -> None:
        """
        Validate proxies in parallel using a thread pool.
        
        Args:
            max_workers (int): Maximum number of concurrent validation threads
        """
        def validate_single_proxy(proxy: str) -> tuple[str, bool]:
            try:
                response = requests.get(
                    self._validation_url,
                    proxies={'http': proxy, 'https': proxy},
                    timeout=5
                )
                return proxy, response.status_code == 200
            except requests.RequestException:
                return proxy, False

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(validate_single_proxy, proxy) for proxy in self._proxies]
            
            for future in as_completed(futures):
                proxy, is_valid = future.result()
                if is_valid:
                    self._valid_proxies.add(proxy)
                else:
                    self._invalid_proxies.add(proxy)

    def get_next(self) -> Optional[str]:
        """
        Get the next valid proxy in a round-robin fashion.
        
        Returns:
            Optional[str]: A valid proxy URL or None if no valid proxies are available
        """
        with self._lock:
            if not self._valid_proxies:
                return None

            valid_proxies = list(self._valid_proxies)
            if not valid_proxies:
                return None

            proxy = valid_proxies[self._index % len(valid_proxies)]
            self._index += 1
            return proxy

    def mark_invalid(self, proxy: str) -> None:
        """
        Mark a proxy as invalid.
        
        Args:
            proxy (str): The proxy URL to mark as invalid
        """
        with self._lock:
            if proxy in self._valid_proxies:
                self._valid_proxies.remove(proxy)
                self._invalid_proxies.add(proxy)

    @property
    def valid_count(self) -> int:
        """Get the number of valid proxies."""
        return len(self._valid_proxies)

    @property
    def invalid_count(self) -> int:
        """Get the number of invalid proxies."""
        return len(self._invalid_proxies)

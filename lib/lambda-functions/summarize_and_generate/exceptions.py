class ConnectionError(Exception):
    """An exception class for connection related errors"""

    def __init__(self, message):
        self.message = message

    def __str__(self):
        return str(self.message)


class CodeError(Exception):
    """An exception class for code/logic related errors"""

    def __init__(self, message):
        self.message = message

    def __str__(self):
        return str(self.message)

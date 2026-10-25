/* Bare-metal newlib hooks. UART diagnostics use HAL directly in foreground;
 * file descriptors and POSIX file I/O are not part of this application. */
#include <errno.h>
#include <sys/types.h>

int _close(int fd)
{
    (void)fd;
    errno = ENOSYS;
    return -1;
}
_off_t _lseek(int fd, _off_t offset, int whence)
{
    (void)fd; (void)offset; (void)whence;
    errno = ENOSYS;
    return (_off_t)-1;
}
_ssize_t _read(int fd, void *buffer, size_t count)
{
    (void)fd; (void)buffer; (void)count;
    errno = ENOSYS;
    return -1;
}
_ssize_t _write(int fd, const void *buffer, size_t count)
{
    (void)fd; (void)buffer; (void)count;
    errno = ENOSYS;
    return -1;
}

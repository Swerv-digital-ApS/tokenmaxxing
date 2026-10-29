package dk.hanskristoffer.tokenmaxxing.companion;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Pattern;

/** Only a single-use code, or its canonical link on our configured HTTPS origin, can enter the WebView. */
final class PairingLink {
    // A desktop link's long code, or a phone's short one (`42-K7QF-M2XP`, Crockford base32).
    private static final Pattern CODE = Pattern.compile(
            "[0-9]{1,12}\\.[A-Za-z0-9_-]{16,128}|[0-9]{1,12}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}");

    static String gameUrl(String server) {
        return server.replaceAll("/+$", "") + "/play";
    }

    static boolean isTrusted(String server, String value) {
        try {
            URI expected = new URI(server);
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getRawUserInfo() == null
                    && expected.getHost() != null
                    && expected.getHost().equalsIgnoreCase(uri.getHost())
                    && port(expected) == port(uri);
        } catch (URISyntaxException | NullPointerException e) {
            return false;
        }
    }

    private static int port(URI uri) { return uri.getPort() == -1 ? 443 : uri.getPort(); }

    static String parse(String server, String input) {
        String code = input == null ? "" : input.trim();
        if (!CODE.matcher(code).matches()) {
            try {
                URI uri = new URI(code);
                if (!isTrusted(server, code) || !"/play".equals(uri.getRawPath())
                        || uri.getRawQuery() != null || uri.getFragment() == null
                        || !uri.getFragment().startsWith("code=")) throw new IllegalArgumentException();
                code = uri.getFragment().substring(5);
            } catch (URISyntaxException e) {
                throw new IllegalArgumentException("Invalid pairing link");
            }
        }
        if (!CODE.matcher(code).matches()) throw new IllegalArgumentException("Invalid pairing code");
        return gameUrl(server) + "#code=" + code;
    }
}

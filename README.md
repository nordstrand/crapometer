# Crap-o-meter

A simple utillity that provides an unbiased measure of web page crappiness

## Usage

    $ node index.js http://yoursite.com
    'http://yoursite.com' page weight: 5MB        of which 48% is crap.

## Mechanism

The web site is is download twice in a Firefox container: first with no form of ad-blocking,
and then with a pretty restrictive hosts file inject. The difference in download size is
considers to consist of **crap**.

A running dockerd is a prerequisite for executing this utillity.




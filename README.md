# NO MORE MAINTAINED ! PLEASE USE [HOMEBRIDGE-MELCLOUD-CONTROL](https://github.com/grzegorz914/homebridge-melcloud-control)


# homebridge-melcloud
Homebridge plugin for Mitsubishi Melcloud

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-melcloud) and should be installed "globally" by typing:

    npm install -g homebridge-melcloud

# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory.
Look for a sample config in [config.json example](https://github.com/ilcato/homebridge-melcloud/blob/master/config.json). 
Simply specify you Melcloud credentials and the language id from one of the following numeric codes:
+ 0	=	en	English
+ 1	=	bg	Български
+ 2	=	cs	Čeština
+ 3	=	da	Dansk
+ 4	=	de	Deutsch
+ 5	=	et	Eesti
+ 6	=	es	Español
+ 7	=	fr	Français
+ 8	=	hy	Հայերեն
+ 9	=	lv	Latviešu
+ 10	=	lt	Lietuvių
+ 11	=	hu	Magyar
+ 12	=	nl	Nederlands
+ 13	=	no	Norwegian
+ 14	=	pl	Polski
+ 15	=	pt	Português
+ 16	=	ru	Русский
+ 17	=	fi	Suomi
+ 18	=	sv	Svenska
+ 19	=	it	Italiano
+ 20	=	uk	Українська
+ 21	=	tr	Türkçe
+ 22	=	el	Ελληνικά
+ 23	=	hr	Hrvatski
+ 24	=	ro	Română
+ 25	=	sl	Slovenščina

# Note
Siri is only able to read and change the target temperature of the Mitsubishi units. Siri can not change the heating/cooling/auto modes directly.
To get around this limitation, you can create a scene with an app like Elgato or iDevices. For example:
a scene named "Switch on the downstairs air conditioning" can turn on the downstairs AC in cooling mode, set it to 25°C and switch the Nest thermostat off.
Dehumidifying mode is not supported through HomeKit. 

# Credit
Thanks to Simon “mGeek” Rubuano for his work on [reverse engineering Melcloud] (http://mgeek.fr/blog/un-peu-de-reverse-engineering-sur-melcloud)



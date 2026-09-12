// Code that delays the flashing red LED using _delay_cycles
#include <msp430fr6989.h>
#include <stdint.h>
#define redLED BIT0 // Red LED at P1.0
#define greenLED BIT7 // Green LED at P9.7
void main(void) {
	volatile unsigned int i, j;
	WDTCTL = WDTPW | WDTHOLD; 	// Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 		// Disable GPIO power-on default high-impedance mode

	P1DIR |= redLED; 	// Direct pin as output
	P1OUT &= ~redLED; 	// Turn LED Off
	P9DIR |= greenLED;	// Direct pin at output
	P9OUT &= ~greenLED;  // Turn LED off
	for(;;){
		for(j=0; j<3; j++){
			for(i=0; i<6; i++) {
				// Delay loop
				__delay_cycles(75000);
               	P1OUT ^= redLED; // Toggle the LED
			}
			for(i=0; i<6; i++) {
				// Delay loop
				__delay_cycles(75000);
                P9OUT ^= greenLED; // Toggle the LED
			}
		}
		for(j=0; j<3; j++){
			for(i=0; i<16; i++) {
				// Delay loop
				__delay_cycles(75000);
               	P1OUT ^= redLED; // Toggle the LED
			}
			for(i=0; i<16; i++) {
				// Delay loop
				__delay_cycles(75000);
                P9OUT ^= greenLED; // Toggle the LED
			}
		}
	}
}

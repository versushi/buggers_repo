// Code that delays the flashing red LED using _delay_cycles
#include <msp430fr6989.h>
#include <stdint.h>
#define redLED BIT0 // Red LED at P1.0

void main(void) {
	volatile uint32_t i;
	WDTCTL = WDTPW | WDTHOLD; 	// Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 		// Disable GPIO power-on default high-impedance mode

	P1DIR |= redLED; 	// Direct pin as output
	P1OUT &= ~redLED; 	// Turn Red LED Off

	for(;;){
		__delay_cycles(3000000);
		P1OUT ^= redLED; // Toggles the Red LED
	}
}